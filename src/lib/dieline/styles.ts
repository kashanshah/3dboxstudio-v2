import { getTemplateRuntime, type TemplateRuntime } from '@/lib/packaging/template-runtime';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';
import type { TemplateGeometryOptions } from '@/lib/packaging/template-runtime';
import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { listedTemplates, resolveTemplateCatalog, type TemplateCatalogEntry, type TemplateSettingsRecord } from '@/lib/packaging/template-catalog';
import { chainSegments, offsetPolygon, pathData, pieceOutlines, sharedEdge, type Point, type Segment } from './geometry';
import type { DielineInput, DielineOutput, DielinePath, DielineStyle, DimensionMode, Panel, StyleParam } from './types';

// The generator's box styles. Each is drawn and folded by one of the
// Studio's parametric templates (src/lib/packaging/parametric/definitions),
// so the flat file and the 3D box come from the same source. A style here
// only says how its three sizes map onto the template's, how it is measured
// crease to crease, and which template options it fixes. Adding a style is
// one entry in STYLE_SPECS.

const MM_PER_IN = 25.4;
/** Margins drawn on the guide layers, in mm. */
export const BLEED_MM = 3;
export const SAFE_MM = 3;

/** Which panel side gives each size when measured crease to crease on the sheet. */
type Measure = Record<'length' | 'width' | 'depth', [panel: string, side: 'width' | 'height']>;
const WALLS: Measure = { length: ['front', 'width'], width: ['left', 'width'], depth: ['front', 'height'] };
const TRAY: Measure = { length: ['bottom', 'width'], width: ['bottom', 'height'], depth: ['front', 'height'] };
/** A drawer box is measured by its sleeve, which is its outside. */
/**
 * A hexagon box's three sizes are across the flats (its bottom's height on the
 * sheet), the lid depth and the height, each up its own walls.
 */
const HEXAGON: Measure = { length: ['bottom', 'height'], width: ['lidFront', 'height'], depth: ['front', 'height'] };
const SLEEVE: Measure = { length: ['sleeveBottom', 'width'], width: ['sleeveBottom', 'height'], depth: ['sleeveLeft', 'width'] };

type StyleSpec = Omit<DielineStyle, 'params' | 'generate' | 'modes' | 'defaults'> & {
  /** Fixed template options (the RSC's flap arrangement). */
  options?: TemplateGeometryOptions;
  /** How to read the manufacture size off the sheet; without it the style can't be sized that way. */
  measure?: Measure;
  /** The size the template itself takes: the inside, or (pillow) the outside, which is then the only mode. */
  native?: 'inner' | 'outer';
  /** Defaults other than the template's own (set in Admin → Templates). */
  defaultDimensions?: CartonDimensions;
};

const STYLE_SPECS: StyleSpec[] = [
  { id: 'reverse-tuck-end', name: 'Reverse tuck end box', category: 'Folding carton', code: 'ECMA A20.20', templateId: 'reverse-tuck-carton', measure: WALLS },
  { id: 'straight-tuck-end', name: 'Straight tuck end box', category: 'Folding carton', code: 'ECMA A15.20', templateId: 'base-box', measure: WALLS },
  { id: 'snap-lock-bottom', name: 'Snap lock (1-2-3) bottom box', category: 'Folding carton', templateId: 'snap-lock-bottom-box', measure: WALLS },
  { id: 'auto-lock-bottom', name: 'Auto lock (crash lock) bottom box', category: 'Folding carton', templateId: 'auto-lock-bottom-box', measure: WALLS },
  { id: 'mailer-box', name: 'Roll end tuck front mailer box', category: 'Corrugated', code: 'FEFCO 0427', templateId: 'mailer-box', measure: TRAY },
  { id: 'shipping-box-rsc', name: 'Regular slotted shipping carton', category: 'Corrugated', code: 'FEFCO 0201', templateId: 'split-top-box', options: { splitTopHingeSide: 'side_b' }, measure: WALLS },
  { id: 'pillow-box', name: 'Pillow box', category: 'Folding carton', templateId: 'pillow-box', native: 'outer' },
  { id: 'gable-box', name: 'Gable box', category: 'Folding carton', templateId: 'gable-box', measure: WALLS },
  { id: 'sleeve-box', name: 'Sleeve', category: 'Folding carton', templateId: 'sleeve-box', measure: WALLS },
  { id: 'pizza-box', name: 'Pizza box', category: 'Corrugated', templateId: 'pizza-box', measure: TRAY },
  { id: 'drawer-box', name: 'Drawer box (tray and sleeve)', category: 'Folding carton', templateId: 'drawer-box', measure: SLEEVE },
  { id: 'rigid-lid-and-base', name: 'Rigid lid and base box', category: 'Rigid', templateId: 'rigid-lid-base', measure: TRAY },
  { id: 'four-corner-tray', name: 'Four-corner tray', category: 'Folding carton', templateId: 'tray-box', measure: TRAY },
  { id: 'telescope-box', name: 'Telescope box (tray with lid)', category: 'Folding carton', templateId: 'telescope-box', measure: TRAY },
  { id: 'cake-box', name: 'Cake box (lock corners, optional window)', category: 'Folding carton', templateId: 'cake-box', measure: TRAY },
  { id: 'hexagon-box', name: 'Hexagon box (lid and base)', category: 'Folding carton', templateId: 'hexagon-box', measure: HEXAGON },
];

const runtimeOf = (spec: StyleSpec): TemplateRuntime => {
  const runtime = getTemplateRuntime(spec.templateId);
  if (!runtime?.getSheetGeometry || !runtime.getFoldPlan) throw new Error(`The ${spec.name} template has no sheet geometry.`);
  return runtime;
};

/** The template's three sizes from a style's length, width and depth. */
const toTemplate = (sizes: { length: number; width: number; depth: number }, thickness: number, adjustments?: Record<string, number>): CartonDimensions =>
  ({ width: sizes.length, height: sizes.depth, depth: sizes.width, thickness, ...(adjustments ? { adjustments } : {}) });

function manufactureSize(runtime: TemplateRuntime, measure: Measure, dimensions: CartonDimensions, options?: TemplateGeometryOptions) {
  const panels = runtime.getDielinePanels(dimensions, options);
  const side = ([id, axis]: [string, 'width' | 'height']) => {
    const panel = panels.find(item => item.id === id);
    if (!panel) throw new Error(`Panel "${id}" is missing.`);
    return panel[axis];
  };
  return { length: side(measure.length), width: side(measure.width), depth: side(measure.depth) };
}

const AXES = ['length', 'width', 'depth'] as const;

/**
 * The inside size that gives the requested size in `mode`: each measure
 * grows one for one with the inside, so stepping the inside by the
 * difference converges in a few rounds.
 */
function solveInner(target: { length: number; width: number; depth: number }, measure: (inner: typeof target) => typeof target) {
  let inner = { ...target };
  for (let round = 0; round < 8; round++) {
    const got = measure(inner);
    const error = Object.fromEntries(AXES.map(axis => [axis, target[axis] - got[axis]])) as typeof target;
    if (AXES.every(axis => Math.abs(error[axis]) < 0.005)) break;
    inner = Object.fromEntries(AXES.map(axis => [axis, inner[axis] + error[axis]])) as typeof target;
  }
  return inner;
}

const titleCase = (label: string) => label.toLowerCase().replace(/(^|[\s-])\S/g, part => part.toUpperCase());
const round = (value: number) => Number(value.toFixed(3));

function makeStyle(spec: StyleSpec): DielineStyle {
  const native = spec.native ?? 'inner';
  // Outer and manufacture sizes are read off the sheet, so a style needs a measure for them.
  const modes: DimensionMode[] = native === 'outer' || !spec.measure ? [native] : ['inner', 'outer', 'manufacture'];
  const template = () => runtimeOf(spec);
  let params: StyleParam[] | null = null;
  let defaults: DielineStyle['defaults'] | null = null;

  const generate = (input: DielineInput): DielineOutput => {
    const runtime = template();
    const scale = input.units === 'in' ? MM_PER_IN : 1;
    const t = input.thickness * scale;
    const warnings: string[] = [];
    if (!(t > 0)) throw new Error('Enter a board thickness above zero.');
    const requested = { length: input.length * scale, width: input.width * scale, depth: input.depth * scale };
    for (const axis of AXES) if (!(requested[axis] > 0)) throw new Error(`Enter a ${axis} above zero.`);
    // Style sizes from the options, in the input's units.
    const adjustments: Record<string, number> = {};
    const keys = new Set((runtime.getAdjustableSizes?.(toTemplate(requested, t), spec.options) ?? []).map(size => size.key));
    for (const [name, value] of Object.entries(input.options ?? {})) {
      if (keys.has(name) && typeof value === 'number' && Number.isFinite(value)) adjustments[name] = value * scale;
    }
    const dims = (inner: typeof requested) => toTemplate(inner, t, Object.keys(adjustments).length ? adjustments : undefined);

    let mode = input.dimensionMode;
    if (!modes.includes(mode)) {
      warnings.push(`The ${spec.name.toLowerCase()} is sized by its ${native === 'outer' ? 'outside' : 'inside'}, so the sizes were used as ${native === 'outer' ? 'outside' : 'inside'} sizes.`);
      mode = native;
    }
    // Outside is crease to crease plus a board: half a board beyond the crease line on each side.
    const inner = mode === native
      ? requested
      : solveInner(requested, size => {
        const made = manufactureSize(runtime, spec.measure!, dims(size), spec.options);
        return mode === 'outer' ? { length: made.length + t, width: made.width + t, depth: made.depth + t } : made;
      });
    for (const axis of AXES) if (!(inner[axis] > 0)) throw new Error(`The ${axis} is too small for this board: the inside would be ${round(inner[axis])} mm.`);

    const dimensions = dims(inner);
    const geometry = runtime.getSheetGeometry!(dimensions, spec.options);
    warnings.push(...(runtime.getSizeProblems?.(dimensions, spec.options) ?? []));

    const segments = (lines: typeof geometry.cut): Segment[] => lines.map(line => [[line.start.x, line.start.y], [line.end.x, line.end.y]]);
    const outline = (points: { x: number; y: number }[]): Point[] => points.map(point => [round(point.x), round(point.y)]);
    const paths: DielinePath[] = [
      { type: 'cut', d: pathData(chainSegments(segments(geometry.cut))) },
      { type: 'crease', d: pathData(chainSegments(segments(geometry.crease))) },
    ];
    const glue = geometry.panels.filter(panel => panel.kind === 'glue');
    if (glue.length) paths.push({ type: 'glue', d: pathData(glue.map(panel => { const points = outline(panel.outline); return [...points, points[0]]; })) });
    const pieces = pieceOutlines(segments(geometry.cut), geometry.panels.map(panel => outline(panel.outline)));
    if (pieces.length) paths.push({ type: 'bleed', d: pathData(pieces.map(piece => offsetPolygon(piece, BLEED_MM)).map(points => [...points, points[0]])) });
    // Safe zones on the printed panels big enough to have one.
    const printed = geometry.panels.filter(panel => panel.kind !== 'glue' && panel.width > 4 * SAFE_MM && panel.height > 4 * SAFE_MM);
    const safe = printed.map(panel => offsetPolygon(outline(panel.outline), -SAFE_MM)).map(points => [...points, points[0]]);
    if (safe.length) paths.push({ type: 'safe', d: pathData(safe) });

    const plan = new Map(runtime.getFoldPlan!(dimensions, spec.options).map(step => [step.panel, step]));
    const outlines = new Map(geometry.panels.map(panel => [panel.id, outline(panel.outline)]));
    const panels: Panel[] = geometry.panels.map(panel => {
      const step = plan.get(panel.id);
      const axis = step ? sharedEdge(outlines.get(step.parent) ?? [], outlines.get(panel.id)!) : null;
      return {
        id: panel.id,
        label: titleCase(panel.label),
        polygon: outlines.get(panel.id)!,
        ...(step ? { foldParent: step.parent, foldAngle: round(step.angle * 180 / Math.PI) } : {}),
        ...(axis ? { foldAxis: axis } : {}),
      };
    });

    return {
      paths,
      panels,
      bounds: { width: round(geometry.bounds.width), height: round(geometry.bounds.height) },
      inner: { length: round(inner.length), width: round(inner.width), depth: round(inner.depth) },
      warnings,
      sizes: (runtime.getAdjustableSizes?.(dimensions, spec.options) ?? []).map(size => ({
        key: size.key, label: size.label, value: round(size.value), defaultValue: round(size.defaultValue), min: round(size.min), max: round(size.max),
      })),
    };
  };

  return {
    id: spec.id, name: spec.name, category: spec.category, ...(spec.code ? { code: spec.code } : {}), templateId: spec.templateId,
    modes,
    ...(spec.measure ? { measure: spec.measure } : {}),
    ...(spec.options?.splitTopHingeSide ? { options: { splitTopHingeSide: spec.options.splitTopHingeSide } } : {}),
    get defaults() {
      return (defaults ??= defaultsOf(spec));
    },
    get params() {
      if (!params) {
        const d = defaultsOf(spec);
        params = (template().getAdjustableSizes?.(toTemplate(d, d.thickness), spec.options) ?? [])
          .map((size): StyleParam => ({ key: size.key, label: size.label, kind: 'length' }));
      }
      return params;
    },
    generate,
  };
}


function defaultsOf(spec: StyleSpec): DielineStyle['defaults'] {
  const d = spec.defaultDimensions ?? getPackagingTemplate(spec.templateId)?.defaultDimensions;
  if (!d) throw new Error(`The ${spec.name} template has no default size.`);
  return { length: d.width, width: d.depth, depth: d.height, thickness: d.thickness };
}

export const DIELINE_STYLES: DielineStyle[] = STYLE_SPECS.map(makeStyle);

const madeStyles = new Map<string, DielineStyle>();
const styleOf = (spec: StyleSpec) => {
  const key = JSON.stringify(spec);
  let style = madeStyles.get(key);
  if (!style) madeStyles.set(key, style = makeStyle(spec));
  return style;
};

/**
 * The styles the generator offers with the admin's template settings: the
 * built-in styles of active templates, renamed or resized where an admin
 * changed them, then named templates (on their style's spec) and uploaded
 * JSON templates (sized by the inside only), in card order.
 */
export function catalogDielineStyles(entries: readonly TemplateCatalogEntry[]): DielineStyle[] {
  const listed = listedTemplates(entries);
  const byId = new Map(listed.map(entry => [entry.id, entry]));
  const builtIn = STYLE_SPECS.flatMap((spec, index) => {
    const entry = byId.get(spec.templateId);
    if (!entry) return [];
    const name = entry.customCopy?.name;
    const original = getPackagingTemplate(spec.templateId)?.defaultDimensions;
    const resized = entry.defaultDimensions && JSON.stringify(entry.defaultDimensions) !== JSON.stringify(original);
    if (!name && !resized) return [DIELINE_STYLES[index]];
    return [styleOf({ ...spec, ...(name ? { name } : {}), ...(resized ? { defaultDimensions: entry.defaultDimensions } : {}) })];
  });
  const added = listed.flatMap(entry => {
    if (entry.source === 'named') {
      const base = STYLE_SPECS.find(spec => spec.templateId === entry.templateId);
      if (!base) return [];
      // Its own name and no industry code: the code names the base style.
      return [styleOf({ ...base, code: undefined, id: entry.id, name: entry.name, defaultDimensions: entry.defaultDimensions })];
    }
    if (entry.source === 'json') {
      return [styleOf({ id: entry.id, name: entry.name, category: entry.family === 'corrugated' ? 'Corrugated' : entry.family === 'rigid-box' ? 'Rigid' : 'Folding carton', templateId: entry.templateId })];
    }
    return [];
  });
  return [...builtIn, ...added];
}

let current = DIELINE_STYLES;
let currentKey = '[]';

/** Switches the generator to the catalog the page was rendered with (thumbnails.ts sends it along). */
export function applyTemplateCatalog(records: readonly TemplateSettingsRecord[]) {
  const key = JSON.stringify(records);
  if (key !== currentKey) {
    const styles = records.length ? catalogDielineStyles(resolveTemplateCatalog(records)) : DIELINE_STYLES;
    // The admin keeps at least one template active; this only guards the picker.
    current = styles.length ? styles : DIELINE_STYLES;
    currentKey = key;
  }
  return current;
}

/** The styles on offer: every built-in one until a catalog is applied. */
export function dielineStyles() {
  return current;
}

export function getDielineStyle(id: string) {
  return current.find(style => style.id === id) ?? null;
}

/** The style drawn by a Studio template (its first, where several share one). */
export function styleForTemplate(templateId: string) {
  return DIELINE_STYLES.find(style => style.templateId === templateId) ?? null;
}
