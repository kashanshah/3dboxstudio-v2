import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { arcPoints, finishExportGeometry, type ExportPanel, type LineMm, type PointMm } from '@/lib/packaging/export-geometry';
import { evaluate, interpolate, type Expr, type Scope } from './expression';
import { PARAMETRIC_TEMPLATE_FORMAT, type DimensionKey, type LineSpec, type OptionSpec, type OutlineEntry, type ExpandedTemplate, type ParametricTemplate, type SurfaceVertex } from './format';
import { expandRepeats } from './repeat';

// The flat half of a parametric template: sizes, the design grid and the
// cutting template. Kept apart from the folding so pages that only show a
// dieline (the public template pages) don't load the 3D code.

export const DIMENSIONS: DimensionKey[] = ['width', 'height', 'depth', 'thickness'];
export type OptionValues = Partial<Record<OptionSpec['source'], string | undefined>>;

export class TemplateDefinitionError extends Error {}

/** A size shown on a panel of the flat sheet: a box dimension or an adjustable size. */
export type MeasuredSize = {
  key: string;
  kind: 'dimension' | 'adjustment';
  label: string;
  value: number;
  min: number;
  max: number;
};

/** The sizes a panel's width (x) and height (y) on the sheet follow one for one. */
export type PanelSizes = { panel: string; x?: MeasuredSize; y?: MeasuredSize };

/** One size the user may change, as it stands for a box. */
export type AdjustableSize = {
  key: string;
  label: string;
  /** In use: the user's value clamped to the limits, or the template's own. */
  value: number;
  /** The template's own value. */
  defaultValue: number;
  min: number;
  max: number;
  adjusted: boolean;
};

export function compileParametricSheet(source: ParametricTemplate) {
  const definition = expandRepeats(source, message => definitionError(source, message));
  checkStructure(definition);

  const adjustable = definition.adjustable ?? [];
  const adjustedBy = new Map(adjustable.flatMap(spec => (spec.targets ?? [spec.key]).map(target => [target, spec] as const)));

  const sanitize = (value: CartonDimensions): CartonDimensions => {
    const result = {} as CartonDimensions;
    for (const key of DIMENSIONS) {
      const spec = definition.parameters[key];
      const entry = value[key];
      result[key] = Number.isFinite(entry)
        ? Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, entry))
        : spec.fallback;
    }
    // Only sizes this template knows; they're clamped when used, since the
    // limits move with the box.
    const adjustments = Object.fromEntries(adjustable
      .map(spec => [spec.key, value.adjustments?.[spec.key]] as const)
      .filter((entry): entry is readonly [string, number] => Number.isFinite(entry[1])));
    if (Object.keys(adjustments).length) result.adjustments = adjustments;
    return result;
  };

  /** Derived values with the user's sizes in place, and how each adjustable size stands. */
  const resolve = (input: CartonDimensions, options: OptionValues = {}) => {
    const dimensions = sanitize(input);
    const { adjustments, ...plain } = dimensions;
    const scope: Record<string, number> = { ...plain };
    for (const option of definition.options ?? []) {
      const chosen = options[option.source];
      Object.assign(scope, option.choices[chosen && chosen in option.choices ? chosen : option.default]);
    }
    const sizes = new Map<string, AdjustableSize>();
    for (const [name, value] of definition.derived) {
      const own = evaluate(value, scope);
      const spec = adjustedBy.get(name);
      if (!spec) {
        scope[name] = own;
        continue;
      }
      const limits = { ...scope, default: own };
      const min = evaluate(spec.min, limits);
      const max = Math.max(min, evaluate(spec.max, limits));
      const wanted = adjustments?.[spec.key];
      scope[name] = wanted === undefined ? own : Math.min(max, Math.max(min, wanted));
      // The first target stands for the size in the studio.
      if (!sizes.has(spec.key)) sizes.set(spec.key, { key: spec.key, label: spec.label, value: scope[name], defaultValue: own, min, max, adjusted: wanted !== undefined });
    }
    return { scope, sizes: adjustable.map(spec => sizes.get(spec.key)!) };
  };

  /** The dimensions, option values and derived values for one box. */
  const values = (input: CartonDimensions, options: OptionValues = {}) => resolve(input, options).scope;

  /** The sizes the user may change, with their current values and limits. */
  const adjustableSizes = (input: CartonDimensions, options: OptionValues = {}) => resolve(input, options).sizes;

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
    .flatMap(line => {
      if ('from' in line) return [{ start: point(line.from, scope), end: point(line.to, scope) }];
      const points = trace([line], scope);
      return points.slice(1).map((end, i) => ({ start: points[i], end }));
    });

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
    if (new Set(panels.map(panel => panel.id)).size !== panels.length) {
      definitionError(definition, `more than one variant of a panel applies (${panels.map(panel => panel.id).join(', ')})`);
    }
    const notes = definition.notes.filter(note => included(note.when, scope)).map(note => interpolate(note.text, scope));
    return finishExportGeometry(panels, definition.export.kind, notes, {
      slits: lines(definition.slits, scope),
      cuts: lines(definition.cuts, scope),
    });
  };

  /** The printable cutting template, after the size checks. */
  /** The size checks this box fails, as messages ("Use a depth of at least 20 mm."). */
  const problems = (input: CartonDimensions, options: OptionValues = {}) => {
    const scope = values(input, options);
    return (definition.validations ?? []).filter(check => !evaluate(check.require, scope)).map(check => interpolate(check.message, scope));
  };

  const exportGeometry = (input: CartonDimensions, options: OptionValues = {}) => {
    const [problem] = problems(input, options);
    if (problem) throw new Error(problem);
    return sheet(input, options);
  };

  /**
   * The panels one adjustable size changes the shape of, found by nudging the
   * size and comparing: panels that only move along don't count.
   */
  const adjustedPanels = (input: CartonDimensions, options: OptionValues, key: string): string[] => {
    const size = adjustableSizes(input, options).find(item => item.key === key);
    if (!size || size.max - size.min < 1e-6) return [];
    const nudged = size.value + (size.value + 1 <= size.max ? 1 : -Math.min(1, size.value - size.min));
    const shapes = (value: number) => new Map(sheet({ ...input, adjustments: { ...input.adjustments, [key]: value } }, options).panels
      .map(panel => [panel.id, panel.outline.map(point => `${(point.x - panel.x).toFixed(4)},${(point.y - panel.y).toFixed(4)}`).join(' ')]));
    const before = shapes(size.value), after = shapes(nudged);
    return [...after.keys()].filter(id => before.get(id) !== after.get(id));
  };

  /**
   * Which size each panel's width and height on the sheet follow one for one,
   * found by nudging every box dimension and adjustable size: a panel side
   * that grows by exactly the nudge shows that size. Adjustable sizes are
   * tried first, so a flap shows its own size rather than the box's.
   */
  const panelSizes = (input: CartonDimensions, options: OptionValues = {}): PanelSizes[] => {
    const extent = (dimensions: CartonDimensions) => new Map(sheet(dimensions, options).panels.map(panel => [panel.id, [panel.width, panel.height] as const]));
    const before = extent(input);
    const result = new Map<string, PanelSizes>([...before.keys()].map(id => [id, { panel: id }]));
    const claim = (size: MeasuredSize, nudged: CartonDimensions, delta: number) => {
      for (const [id, after] of extent(nudged)) {
        const entry = result.get(id), was = before.get(id);
        if (!entry || !was) continue;
        (['x', 'y'] as const).forEach((axis, i) => {
          if (!entry[axis] && Math.abs((after[i] - was[i]) / delta - 1) < 0.02) entry[axis] = size;
        });
      }
    };
    for (const size of adjustableSizes(input, options)) {
      if (size.max - size.min < 1e-6) continue;
      const delta = size.value + 1 <= size.max ? 1 : -Math.min(1, size.value - size.min);
      claim({ key: size.key, kind: 'adjustment', label: size.label, value: size.value, min: size.min, max: size.max },
        { ...input, adjustments: { ...input.adjustments, [size.key]: size.value + delta } }, delta);
    }
    const clean = sanitize(input);
    const labels = new Map((definition.catalog?.parameters ?? []).map(parameter => [parameter.key, parameter]));
    for (const key of ['width', 'height', 'depth'] as const) {
      const spec = definition.parameters[key], control = labels.get(key);
      const min = Math.max(spec.min ?? 1, control?.min ?? 1), max = Math.min(spec.max ?? Infinity, control?.max ?? Infinity);
      const delta = clean[key] + 1 <= max ? 1 : -1;
      claim({ key, kind: 'dimension', label: control?.label ?? key[0].toUpperCase() + key.slice(1), value: clean[key], min, max },
        { ...clean, [key]: clean[key] + delta }, delta);
    }
    return [...result.values()].filter(entry => entry.x || entry.y);
  };

  return { definition, sanitize, values, adjustableSizes, adjustedPanels, panelSizes, sheet, problems, exportGeometry };
}

export type ParametricSheet = ReturnType<typeof compileParametricSheet>;

export function definitionError(definition: Pick<ParametricTemplate, 'templateId'>, message: string): never {
  throw new TemplateDefinitionError(`Template ${definition.templateId}: ${message}`);
}

function checkStructure(definition: ExpandedTemplate) {
  const fail = (message: string) => definitionError(definition, message);
  if (definition.format !== PARAMETRIC_TEMPLATE_FORMAT) fail(`unsupported format "${definition.format}"`);
  for (const key of DIMENSIONS) if (!definition.parameters?.[key]) fail(`missing parameter "${key}"`);
  const copies = new Map<string, number>();
  for (const panel of definition.panels) {
    copies.set(panel.id, (copies.get(panel.id) ?? 0) + 1);
    if ('outline' in panel && panel.outline.length < 3) fail(`panel "${panel.id}" needs at least three corners`);
    // The 3D model folds four-corner panels; a cut outline with curves or
    // more corners gives the four it folds separately.
    const plainQuad = 'rect' in panel || (panel.outline.length === 4 && panel.outline.every(Array.isArray));
    if (panel.fold ? panel.fold.length !== 4 : !plainQuad) fail(`panel "${panel.id}" needs a four-corner fold shape`);
    if (panel.model && panel.model.length !== 4) fail(`panel "${panel.id}" needs four corners for its model shape`);
  }
  for (const panel of definition.panels) {
    if (copies.get(panel.id)! > 1 && panel.when === undefined) fail(`panel "${panel.id}" is defined twice; give every copy a "when"`);
  }
  const panelIds = new Set(copies.keys());
  // The model folds model panels in place of the panels they replace.
  const replaced = new Set<string>(), modelIds = new Set<string>();
  for (const piece of definition.fold.modelPanels ?? []) {
    if (panelIds.has(piece.id) || modelIds.has(piece.id)) fail(`model panel "${piece.id}" reuses an id`);
    if (!panelIds.has(piece.of)) fail(`model panel "${piece.id}" stands in for unknown panel "${piece.of}"`);
    if (piece.outline?.length !== 4) fail(`model panel "${piece.id}" needs four corners`);
    modelIds.add(piece.id);
    replaced.add(piece.of);
  }
  for (const surface of definition.fold.surfaces ?? []) {
    if (!panelIds.has(surface.of)) fail(`a surface stands in for unknown panel "${surface.of}"`);
    if (surface.rows.length < 2 || surface.rows.some(row => row.length !== surface.rows[0].length || row.length < 2)) {
      fail(`the surface for "${surface.of}" needs two or more rows of the same length`);
    }
    replaced.add(surface.of);
  }
  const ids = new Set([...[...panelIds].filter(id => !replaced.has(id)), ...modelIds]);
  const placedOn = (vertex: SurfaceVertex): string[] => 'on' in vertex ? [vertex.on] : 'from' in vertex ? placedOn(vertex.from) : vertex.mix.flatMap(placedOn);
  for (const surface of definition.fold.surfaces ?? []) for (const row of surface.rows) for (const point of row) {
    for (const on of placedOn(point.place)) if (!ids.has(on)) fail(`the surface for "${surface.of}" is placed on "${on}", which the model doesn't fold`);
  }
  if (!ids.has(definition.fold.root)) fail(`fold root "${definition.fold.root}" is not a panel`);
  const roots = new Set([definition.fold.root, ...(definition.fold.pieces ?? []).map(piece => piece.root)]);
  if (roots.size !== 1 + (definition.fold.pieces?.length ?? 0)) fail('each piece needs a root panel of its own');
  for (const piece of definition.fold.pieces ?? []) {
    if (!ids.has(piece.root)) fail(`piece root "${piece.root}" is not a panel`);
    if (piece.matrix.length !== 16) fail(`the placement matrix for piece "${piece.root}" needs 16 values`);
  }
  if (!definition.fold.offset === !definition.fold.matrix) fail('the fold needs either an offset or a placement matrix');
  if (definition.fold.matrix && definition.fold.matrix.length !== 16) fail('the placement matrix needs 16 values');
  const hinged = new Map<string, number>();
  for (const hinge of definition.fold.hinges) {
    for (const end of [hinge.child, hinge.parent]) if (!ids.has(end)) fail(`hinge refers to unknown panel "${end}"`);
    if (roots.has(hinge.child)) fail(`the fold root "${hinge.child}" cannot hinge on another panel`);
    hinged.set(hinge.child, (hinged.get(hinge.child) ?? 0) + 1);
  }
  for (const hinge of definition.fold.hinges) {
    if (hinged.get(hinge.child)! > 1 && hinge.when === undefined) fail(`panel "${hinge.child}" hinges on more than one panel; give every hinge for it a "when"`);
  }
  for (const id of ids) {
    if (!roots.has(id) && !hinged.has(id)) fail(`panel "${id}" is not attached to anything by a hinge`);
  }
  const derived = new Set(definition.derived.map(([name]) => name));
  const keys = new Set<string>(), targets = new Set<string>();
  for (const spec of definition.adjustable ?? []) {
    if (keys.has(spec.key)) fail(`adjustable size "${spec.key}" is listed twice`);
    keys.add(spec.key);
    for (const target of spec.targets ?? [spec.key]) {
      if (!derived.has(target)) fail(`adjustable size "${spec.key}" targets "${target}", which is not a derived value`);
      if (targets.has(target)) fail(`derived value "${target}" is adjusted by more than one size`);
      targets.add(target);
    }
  }
}
