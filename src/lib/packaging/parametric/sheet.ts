import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { arcPoints, finishExportGeometry, type ExportPanel, type LineMm, type PointMm } from '@/lib/packaging/export-geometry';
import { evaluate, interpolate, type Expr, type Scope } from './expression';
import { PARAMETRIC_TEMPLATE_FORMAT, type DimensionKey, type LineSpec, type OptionSpec, type OutlineEntry, type ParametricTemplate } from './format';

// The flat half of a parametric template: sizes, the design grid and the
// cutting template. Kept apart from the folding so pages that only show a
// dieline (the public template pages) don't load the 3D code.

export const DIMENSIONS: DimensionKey[] = ['width', 'height', 'depth', 'thickness'];
export type OptionValues = Partial<Record<OptionSpec['source'], string | undefined>>;

export class TemplateDefinitionError extends Error {}

export function compileParametricSheet(definition: ParametricTemplate) {
  checkStructure(definition);

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

  /** The dimensions, option values and derived values for one box. */
  const values = (input: CartonDimensions, options: OptionValues = {}) => {
    const scope: Record<string, number> = { ...sanitize(input) };
    for (const option of definition.options ?? []) {
      const chosen = options[option.source];
      Object.assign(scope, option.choices[chosen && chosen in option.choices ? chosen : option.default]);
    }
    for (const [name, value] of definition.derived) scope[name] = evaluate(value, scope);
    return scope;
  };

  const included = (when: Expr | undefined, scope: Scope) => when === undefined || evaluate(when, scope) !== 0;
  const point = ([x, y]: [Expr, Expr], scope: Scope): PointMm => ({ x: evaluate(x, scope), y: evaluate(y, scope) });
  const trace = (entries: OutlineEntry[], scope: Scope) => entries.flatMap(entry => {
    if (Array.isArray(entry)) return [point(entry, scope)];
    const { center, radius, from, to, segments } = entry.arc;
    const { x, y } = point(center, scope);
    const radians = (degrees: Expr) => (evaluate(degrees, scope) / 180) * Math.PI;
    return arcPoints(x, y, evaluate(radius, scope), radians(from), radians(to), segments);
  });
  const lines = (specs: LineSpec[] | undefined, scope: Scope): LineMm[] => (specs ?? [])
    .filter(line => included(line.when, scope))
    .map(line => ({ start: point(line.from, scope), end: point(line.to, scope) }));

  /** The cutting template, which is also the design grid. */
  const sheet = (input: CartonDimensions, options: OptionValues = {}) => {
    const scope = values(input, options);
    const panels: ExportPanel[] = definition.panels.filter(panel => included(panel.when, scope)).map(panel => {
      let outline: PointMm[];
      if ('rect' in panel) {
        const [x, y, width, height] = panel.rect.map(value => evaluate(value, scope));
        outline = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
      } else {
        outline = trace(panel.outline, scope);
      }
      const xs = outline.map(corner => corner.x), ys = outline.map(corner => corner.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      return {
        id: panel.id, label: panel.label, kind: panel.kind, sourceId: panel.id,
        x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, outline,
        ...(panel.fold ? { fold: panel.fold.map(corner => point(corner, scope)) } : {}),
        ...(panel.artworkRotation ? { artworkRotation: panel.artworkRotation } : {}),
      };
    });
    const notes = definition.notes.filter(note => included(note.when, scope)).map(note => interpolate(note.text, scope));
    return finishExportGeometry(panels, definition.export.kind, notes, {
      slits: lines(definition.slits, scope),
      cuts: lines(definition.cuts, scope),
    });
  };

  /** The printable cutting template, after the size checks. */
  const exportGeometry = (input: CartonDimensions, options: OptionValues = {}) => {
    const scope = values(input, options);
    for (const check of definition.validations ?? []) {
      if (!evaluate(check.require, scope)) throw new Error(interpolate(check.message, scope));
    }
    return sheet(input, options);
  };

  return { definition, sanitize, values, sheet, exportGeometry };
}

export type ParametricSheet = ReturnType<typeof compileParametricSheet>;

export function definitionError(definition: ParametricTemplate, message: string): never {
  throw new TemplateDefinitionError(`Template ${definition.templateId}: ${message}`);
}

function checkStructure(definition: ParametricTemplate) {
  const fail = (message: string) => definitionError(definition, message);
  if (definition.format !== PARAMETRIC_TEMPLATE_FORMAT) fail(`unsupported format "${definition.format}"`);
  for (const key of DIMENSIONS) if (!definition.parameters?.[key]) fail(`missing parameter "${key}"`);
  const ids = new Set<string>();
  for (const panel of definition.panels) {
    if (ids.has(panel.id)) fail(`panel "${panel.id}" is defined twice`);
    ids.add(panel.id);
    if ('outline' in panel && panel.outline.length < 3) fail(`panel "${panel.id}" needs at least three corners`);
    // The 3D model folds four-corner panels; a cut outline with curves or
    // more corners gives the four it folds separately.
    const plainQuad = 'rect' in panel || (panel.outline.length === 4 && panel.outline.every(Array.isArray));
    if (panel.fold ? panel.fold.length !== 4 : !plainQuad) fail(`panel "${panel.id}" needs a four-corner fold shape`);
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
