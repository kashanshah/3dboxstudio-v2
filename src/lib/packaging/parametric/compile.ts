import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import type { TemplateGeometryOptions, TemplateRuntime } from '@/lib/packaging/template-runtime';
import type { Mesh, TemplateMeshInput } from '@/lib/packaging/template-mesh';
import { finishExportGeometry, type ExportPanel, type LineMm, type PointMm } from '@/lib/packaging/export-geometry';
import { foldSheet, translation, type SheetHinge, type SheetPanel } from '@/lib/packaging/fold-sheet';
import { panelName, substage } from '@/lib/packaging/templates/folded-box';
import { evaluate, interpolate, type Expr, type Scope } from './expression';
import { PARAMETRIC_TEMPLATE_FORMAT, type DimensionKey, type LineSpec, type ParametricTemplate } from './format';

const DIMENSIONS: DimensionKey[] = ['width', 'height', 'depth', 'thickness'];
type OptionValues = Partial<Record<'splitTopHingeSide' | 'openingMode', string | undefined>>;

export class TemplateDefinitionError extends Error {}

/**
 * Turns a parametric definition into the runtime the studio uses for every
 * template. The definition is checked up front, structurally and by building
 * every variant once at its fallback size, so mistakes surface when the
 * template is registered rather than when someone opens it.
 */
export function compileParametricTemplate(definition: ParametricTemplate): TemplateRuntime {
  const fail = (message: string): never => {
    throw new TemplateDefinitionError(`Template ${definition.templateId}: ${message}`);
  };
  checkStructure(definition, fail);

  const sanitize = (value: CartonDimensions): CartonDimensions => {
    const result = {} as CartonDimensions;
    for (const key of DIMENSIONS) {
      const spec = definition.parameters[key];
      const entry = value[key];
      result[key] = Number.isFinite(entry)
        ? Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, entry))
        : spec.fallback;
    }
    return result;
  };

  const scopeFor = (input: CartonDimensions, options: OptionValues) => {
    const dimensions = sanitize(input);
    const scope: Record<string, number> = { ...dimensions };
    for (const option of definition.options ?? []) {
      const chosen = options[option.source];
      Object.assign(scope, option.choices[chosen && chosen in option.choices ? chosen : option.default]);
    }
    for (const [name, value] of definition.derived) scope[name] = evaluate(value, scope);
    return scope;
  };

  const included = (when: Expr | undefined, scope: Scope) => when === undefined || evaluate(when, scope) !== 0;
  const point = ([x, y]: [Expr, Expr], scope: Scope): PointMm => ({ x: evaluate(x, scope), y: evaluate(y, scope) });
  const lines = (specs: LineSpec[] | undefined, scope: Scope): LineMm[] => (specs ?? [])
    .filter(line => included(line.when, scope))
    .map(line => ({ start: point(line.from, scope), end: point(line.to, scope) }));

  const sheet = (input: CartonDimensions, options: OptionValues) => {
    const scope = scopeFor(input, options);
    const panels: ExportPanel[] = definition.panels.filter(panel => included(panel.when, scope)).map(panel => {
      let outline: PointMm[];
      if ('rect' in panel) {
        const [x, y, width, height] = panel.rect.map(value => evaluate(value, scope));
        outline = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
      } else {
        outline = panel.outline.map(corner => point(corner, scope));
      }
      const xs = outline.map(corner => corner.x), ys = outline.map(corner => corner.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      return {
        id: panel.id, label: panel.label, kind: panel.kind, sourceId: panel.id,
        x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, outline,
        ...(panel.artworkRotation ? { artworkRotation: panel.artworkRotation } : {}),
      };
    });
    const notes = definition.notes.filter(note => included(note.when, scope)).map(note => interpolate(note.text, scope));
    const geometry = finishExportGeometry(panels, definition.export.kind, notes, {
      slits: lines(definition.slits, scope),
      cuts: lines(definition.cuts, scope),
    });
    return { geometry, scope };
  };

  const exportGeometry = (input: CartonDimensions, options: OptionValues) => {
    const scope = scopeFor(input, options);
    for (const check of definition.validations ?? []) {
      if (!evaluate(check.require, scope)) throw new Error(interpolate(check.message, scope));
    }
    return sheet(input, options).geometry;
  };

  const meshes = (input: TemplateMeshInput): Mesh[] => {
    const options = { splitTopHingeSide: input.splitTopHingeSide, openingMode: input.openingMode };
    const { geometry, scope: base } = sheet(input.dimensions, options);
    const scope: Record<string, number> = { ...base };
    for (const panel of geometry.panels) {
      Object.assign(scope, {
        [`${panel.id}.x`]: panel.x, [`${panel.id}.y`]: panel.y,
        [`${panel.id}.width`]: panel.width, [`${panel.id}.height`]: panel.height,
      });
    }
    scope.foldT = evaluate(definition.fold.thickness, scope);
    const progress = {
      formation: Math.min(1, Math.max(0, input.formation / 100)),
      closing: 1 - Math.min(1, Math.max(0, input.opening / 100)),
    };
    const present = new Set(geometry.panels.map(panel => panel.id));
    const hinges: SheetHinge[] = definition.fold.hinges.filter(hinge => present.has(hinge.child)).map(hinge => ({
      child: hinge.child,
      parent: hinge.parent,
      angle: substage(progress[hinge.drive], evaluate(hinge.from, scope), evaluate(hinge.to, scope))
        * (evaluate(hinge.degrees ?? 90, scope) / 90) * (Math.PI / 2),
      ...(hinge.setback === undefined ? {} : { setback: evaluate(hinge.setback, scope) }),
    }));
    const specs = new Map(definition.panels.map(panel => [panel.id, panel]));
    const panels: SheetPanel[] = geometry.panels.map(panel => {
      const spec = specs.get(panel.id)!;
      return {
        id: panel.id,
        name: spec.name ?? panelName(panel.label),
        outline: panel.outline,
        ...(spec.layer === undefined ? {} : { layer: evaluate(spec.layer, scope) }),
        ...(spec.artworkRotation ? { artworkRotation: spec.artworkRotation } : {}),
        ...(spec.closureFlap ? { closureFlap: true } : {}),
      };
    });
    const [x, y, z] = definition.fold.offset.map(value => evaluate(value, scope));
    const fallbacks = new Map(definition.panels.filter(panel => panel.artworkFallback)
      .map(panel => [panel.name ?? panelName(panel.label), panel.artworkFallback!]));
    return foldSheet({
      panels, hinges, root: definition.fold.root, thickness: scope.foldT,
      color: input.color, interiorColor: input.interiorColor,
      placement: translation([x, y, z]),
    }).map(mesh => {
      const own = mesh.panel?.replace(/^Interior /, '');
      const fallback = own ? fallbacks.get(own) : undefined;
      if (!fallback) return mesh;
      mesh.fallbackPanel = mesh.panel!.startsWith('Interior ') ? `Interior ${fallback.name}` : fallback.name;
      mesh.fallbackUv = fallback.uv;
      return mesh;
    });
  };

  const fromOptions = (options?: TemplateGeometryOptions): OptionValues => ({
    splitTopHingeSide: options?.splitTopHingeSide,
    openingMode: options?.openingMode,
  });
  const { openingStage } = definition.assembly;
  const runtime: TemplateRuntime = {
    templateId: definition.templateId,
    structureKey: definition.structureKey,
    rendererKey: definition.rendererKey,
    sanitizeParameters: sanitize,
    getDielinePanels: (dimensions, options) => sheet(dimensions, fromOptions(options)).geometry.panels,
    getDielineBounds: (dimensions, options) => sheet(dimensions, fromOptions(options)).geometry.bounds,
    getExportGeometry: (dimensions, options) => exportGeometry(dimensions, fromOptions(options)),
    buildMeshes: meshes,
    exportSummary: definition.export.summary,
    exportArtworkNote: definition.export.artworkNote,
    assembly: {
      control: definition.assembly.control,
      defaultOpeningMode: definition.assembly.defaultOpeningMode as LegacyOpeningMode,
      legacyOpeningAsFormation: definition.assembly.legacyOpeningAsFormation,
      hasOpeningStage: mode => openingStage === 'always' || (Array.isArray(openingStage) && openingStage.includes(mode)),
    },
  };

  // Build every variant once so a bad expression or a panel the folds never
  // reach fails now, with the template named.
  for (const options of variants(definition)) {
    try {
      const fallback = Object.fromEntries(DIMENSIONS.map(key => [key, definition.parameters[key].fallback])) as CartonDimensions;
      const scope = scopeFor(fallback, options);
      for (const check of definition.validations ?? []) {
        evaluate(check.require, scope);
        interpolate(check.message, scope);
      }
      meshes({
        dimensions: fallback, formation: 50, opening: 50,
        openingMode: (options.openingMode ?? definition.assembly.defaultOpeningMode) as LegacyOpeningMode,
        splitTopHingeSide: (options.splitTopHingeSide ?? 'side_a') as 'side_a' | 'side_b',
        color: [1, 1, 1], interiorColor: [1, 1, 1],
      });
    } catch (error) {
      fail(`${error instanceof Error ? error.message : String(error)} (options ${JSON.stringify(options)})`);
    }
  }
  return runtime;
}

function checkStructure(definition: ParametricTemplate, fail: (message: string) => never) {
  if (definition.format !== PARAMETRIC_TEMPLATE_FORMAT) fail(`unsupported format "${definition.format}"`);
  for (const key of DIMENSIONS) if (!definition.parameters?.[key]) fail(`missing parameter "${key}"`);
  const ids = new Set<string>();
  for (const panel of definition.panels) {
    if (ids.has(panel.id)) fail(`panel "${panel.id}" is defined twice`);
    ids.add(panel.id);
    if ('outline' in panel && panel.outline.length < 3) fail(`panel "${panel.id}" needs at least three corners`);
  }
  if (!ids.has(definition.fold.root)) fail(`fold root "${definition.fold.root}" is not a panel`);
  const parents = new Map<string, string>();
  for (const hinge of definition.fold.hinges) {
    for (const end of [hinge.child, hinge.parent]) if (!ids.has(end)) fail(`hinge refers to unknown panel "${end}"`);
    if (hinge.child === definition.fold.root) fail(`the fold root "${hinge.child}" cannot hinge on another panel`);
    if (parents.has(hinge.child)) fail(`panel "${hinge.child}" hinges on more than one panel`);
    parents.set(hinge.child, hinge.parent);
  }
  for (const id of ids) {
    if (id !== definition.fold.root && !parents.has(id)) fail(`panel "${id}" is not attached to anything by a hinge`);
  }
  for (const id of ids) {
    const seen = new Set<string>();
    for (let at = id; at !== definition.fold.root; at = parents.get(at)!) {
      if (seen.has(at)) fail(`hinges loop back on themselves at "${at}"`);
      seen.add(at);
    }
  }
}

function variants(definition: ParametricTemplate): OptionValues[] {
  return (definition.options ?? []).reduce<OptionValues[]>(
    (all, option) => all.flatMap(partial => Object.keys(option.choices).map(choice => ({ ...partial, [option.source]: choice }))),
    [{}],
  );
}
