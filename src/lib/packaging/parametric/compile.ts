import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import type { TemplateGeometryOptions, TemplateRuntime } from '@/lib/packaging/template-runtime';
import type { Mesh, TemplateMeshBuilder } from '@/lib/packaging/template-mesh';
import { foldSheet, translation, type SheetHinge, type SheetPanel } from '@/lib/packaging/fold-sheet';
import { panelName, substage } from '@/lib/packaging/templates/folded-box';
import { evaluate, interpolate } from './expression';
import type { ParametricTemplate } from './format';
import { compileParametricSheet, definitionError, DIMENSIONS, type OptionValues, type ParametricSheet } from './sheet';

export { TemplateDefinitionError } from './sheet';

/** Folds a parametric template's cutting template into its 3D model. */
export function parametricMeshBuilder(compiled: ParametricSheet): TemplateMeshBuilder {
  const { definition } = compiled;
  const specs = new Map(definition.panels.map(panel => [panel.id, panel]));
  const fallbacks = new Map(definition.panels.filter(panel => panel.artworkFallback)
    .map(panel => [panel.name ?? panelName(panel.label), panel.artworkFallback!]));

  return input => {
    const options = { splitTopHingeSide: input.splitTopHingeSide, openingMode: input.openingMode };
    const geometry = compiled.sheet(input.dimensions, options);
    const scope: Record<string, number> = compiled.values(input.dimensions, options);
    for (const panel of geometry.panels) {
      Object.assign(scope, {
        [`${panel.id}.x`]: panel.x, [`${panel.id}.y`]: panel.y,
        [`${panel.id}.width`]: panel.width, [`${panel.id}.height`]: panel.height,
      });
    }
    scope.foldT = evaluate(definition.fold.thickness, scope);
    const progress = {
      formation: Math.min(1, Math.max(0, input.formation / 100)),
      opening: Math.min(1, Math.max(0, input.opening / 100)),
    };
    Object.assign(scope, progress);
    for (const [name, value] of definition.fold.motions ?? []) scope[name] = evaluate(value, scope);
    const present = new Set(geometry.panels.map(panel => panel.id));
    const active = definition.fold.hinges.filter(hinge => present.has(hinge.child) && (hinge.when === undefined || evaluate(hinge.when, scope) !== 0));
    checkHingeTree(definition, present, active);
    const hinges: SheetHinge[] = active.map(hinge => ({
      child: hinge.child,
      parent: hinge.parent,
      angle: 'angle' in hinge
        ? evaluate(hinge.angle, scope)
        : substage(hinge.drive === 'formation' ? progress.formation : 1 - progress.opening, evaluate(hinge.from, scope), evaluate(hinge.to, scope))
          * (evaluate(hinge.degrees ?? 90, scope) / 90) * (Math.PI / 2),
      ...(hinge.setback === undefined ? {} : { setback: evaluate(hinge.setback, scope) }),
    }));
    const panels: SheetPanel[] = geometry.panels.map(panel => {
      const spec = specs.get(panel.id)!;
      return {
        id: panel.id,
        name: spec.name ?? panelName(panel.label),
        // The 3D folds each panel's four-corner shape; the print file cuts the full outline.
        outline: panel.fold ?? panel.outline,
        ...(spec.layer === undefined ? {} : { layer: evaluate(spec.layer, scope) }),
        ...(spec.artworkRotation ? { artworkRotation: spec.artworkRotation } : {}),
        ...(spec.closureFlap ? { closureFlap: true } : {}),
      };
    });
    const [x, y, z] = definition.fold.offset.map(value => evaluate(value, scope));
    return foldSheet({
      panels, hinges, root: definition.fold.root, thickness: scope.foldT,
      color: input.color, interiorColor: input.interiorColor,
      placement: translation([x, y, z]),
    }).map((mesh: Mesh) => {
      const own = mesh.panel?.replace(/^Interior /, '');
      const fallback = own ? fallbacks.get(own) : undefined;
      if (!fallback) return mesh;
      mesh.fallbackPanel = mesh.panel!.startsWith('Interior ') ? `Interior ${fallback.name}` : fallback.name;
      mesh.fallbackUv = fallback.uv;
      return mesh;
    });
  };
}

/**
 * Turns a parametric definition into the runtime the studio uses for every
 * template. The definition is checked up front, structurally and by building
 * every variant once at its fallback size, so mistakes surface when the
 * template is registered rather than when someone opens it.
 */
export function compileParametricTemplate(definition: ParametricTemplate): TemplateRuntime {
  const compiled = compileParametricSheet(definition);
  const buildMeshes = parametricMeshBuilder(compiled);
  const fromOptions = (options?: TemplateGeometryOptions): OptionValues => ({
    splitTopHingeSide: options?.splitTopHingeSide,
    openingMode: options?.openingMode,
  });
  const { openingStage } = definition.assembly;
  const runtime: TemplateRuntime = {
    templateId: definition.templateId,
    structureKey: definition.structureKey,
    rendererKey: definition.rendererKey,
    sanitizeParameters: compiled.sanitize,
    getDielinePanels: (dimensions, options) => compiled.sheet(dimensions, fromOptions(options)).panels,
    getDielineBounds: (dimensions, options) => compiled.sheet(dimensions, fromOptions(options)).bounds,
    getExportGeometry: (dimensions, options) => compiled.exportGeometry(dimensions, fromOptions(options)),
    buildMeshes,
    exportSummary: definition.export.summary,
    exportArtworkNote: definition.export.artworkNote,
    assembly: {
      control: definition.assembly.control,
      defaultOpeningMode: definition.assembly.defaultOpeningMode as LegacyOpeningMode,
      legacyOpeningAsFormation: definition.assembly.legacyOpeningAsFormation,
      hasOpeningStage: mode => openingStage === 'always'
        || (Array.isArray(openingStage) ? openingStage.includes(mode) : typeof openingStage === 'object' && !openingStage.except.includes(mode)),
    },
  };

  // Build every variant once so a bad expression fails now, with the template named.
  const fallback = Object.fromEntries(DIMENSIONS.map(key => [key, definition.parameters[key].fallback])) as CartonDimensions;
  for (const options of variants(definition)) {
    try {
      const scope = compiled.values(fallback, options);
      for (const check of definition.validations ?? []) {
        evaluate(check.require, scope);
        interpolate(check.message, scope);
      }
      buildMeshes({
        dimensions: fallback, formation: 50, opening: 50,
        openingMode: (options.openingMode ?? definition.assembly.defaultOpeningMode) as LegacyOpeningMode,
        splitTopHingeSide: (options.splitTopHingeSide ?? 'side_a') as 'side_a' | 'side_b',
        color: [1, 1, 1], interiorColor: [1, 1, 1],
      });
    } catch (error) {
      definitionError(definition, `${error instanceof Error ? error.message : String(error)} (options ${JSON.stringify(options)})`);
    }
  }
  return runtime;
}

/** Every panel but the root hangs on exactly one present panel, and the hinges reach the root. */
function checkHingeTree(definition: ParametricTemplate, present: Set<string>, hinges: ParametricTemplate['fold']['hinges']) {
  const parents = new Map<string, string>();
  for (const hinge of hinges) {
    if (parents.has(hinge.child)) definitionError(definition, `panel "${hinge.child}" hinges on more than one panel here`);
    if (!present.has(hinge.parent)) definitionError(definition, `panel "${hinge.child}" hinges on "${hinge.parent}", which is left out here`);
    parents.set(hinge.child, hinge.parent);
  }
  for (const id of present) {
    if (id === definition.fold.root) continue;
    if (!parents.has(id)) definitionError(definition, `panel "${id}" has no hinge here`);
    const seen = new Set<string>();
    for (let at = id; at !== definition.fold.root; at = parents.get(at)!) {
      if (seen.has(at)) definitionError(definition, `hinges loop back on themselves at "${at}"`);
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
