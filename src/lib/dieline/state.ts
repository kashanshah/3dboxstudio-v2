import type { DielineStyle, DimensionMode, Units } from './types';

// The generator's settings and how they travel: in the page URL, so a link
// reopens the same box (?style=mailer-box&l=220&w=160&d=80&u=mm&t=1.5…), and
// in localStorage, so a returning visitor finds their last box. Kept apart
// from the UI so both can be tested without a browser.

export const MM_PER_IN = 25.4;
const MM_PER_PT = 0.0254;

/** Board presets; thickness is the caliper in mm. */
export const MATERIALS = [
  { id: 'sbs18', label: '18 pt SBS card', thickness: 0.46 },
  { id: 'sbs24', label: '24 pt SBS card', thickness: 0.61 },
  // Folding boxboard of 350 gsm is about 0.45–0.55 mm thick, depending on the mill.
  { id: 'fbb350', label: '350 gsm folding boxboard', thickness: 0.5 },
  { id: 'eflute', label: 'E-flute corrugated', thickness: 1.5 },
  { id: 'bflute', label: 'B-flute corrugated', thickness: 3 },
  { id: 'grey2', label: '2 mm greyboard (rigid)', thickness: 2 },
] as const;
export const CUSTOM_MATERIAL = 'custom';

export type GeneratorState = {
  style: string;
  /** Length, width and depth in `units`. */
  length: number;
  width: number;
  depth: number;
  units: Units;
  mode: DimensionMode;
  material: string;
  /** Board caliper in mm, whatever the units. */
  thickness: number;
  /** Style sizes the user set, in `units`. */
  options: Record<string, number>;
};

const MAX_MM = 3000;
const MODES: DimensionMode[] = ['inner', 'outer', 'manufacture'];

/** The preset matching a caliper, or custom. */
export function materialFor(thickness: number) {
  return MATERIALS.find(material => Math.abs(material.thickness - thickness) < 1e-6)?.id ?? CUSTOM_MATERIAL;
}

/** Points (thousandths of an inch) for a caliper in mm, as North American board is sold. */
export const toPoints = (mm: number) => Math.round(mm / MM_PER_PT);

export const roundTo = (value: number, units: Units) => (units === 'in' ? Math.round(value * 1000) / 1000 : Math.round(value * 10) / 10);
export const convert = (value: number, from: Units, to: Units) => (from === to ? value : roundTo(from === 'mm' ? value / MM_PER_IN : value * MM_PER_IN, to));

/** A style's default settings, in mm or converted to inches. */
export function defaultState(style: DielineStyle, units: Units = 'mm'): GeneratorState {
  const d = style.defaults;
  return {
    style: style.id,
    length: convert(d.length, 'mm', units), width: convert(d.width, 'mm', units), depth: convert(d.depth, 'mm', units),
    units, mode: style.modes[0], material: materialFor(d.thickness), thickness: d.thickness, options: {},
  };
}

/** Query parameters for a state: short keys, style sizes as o_<key>. */
export function encodeState(state: GeneratorState): URLSearchParams {
  const query = new URLSearchParams({
    style: state.style,
    l: String(state.length), w: String(state.width), d: String(state.depth),
    u: state.units, mode: state.mode, t: String(state.thickness),
  });
  if (state.material !== materialFor(state.thickness)) query.set('mat', state.material);
  for (const [key, value] of Object.entries(state.options)) query.set(`o_${key}`, String(value));
  return query;
}

/** Whether a query sets any of the generator's settings. */
export function hasState(query: URLSearchParams) {
  const keys = ['style', 'l', 'w', 'd', 'u', 'mode', 't', 'mat'];
  return [...query.keys()].some(key => keys.includes(key) || key.startsWith('o_'));
}

/**
 * The state a query asks for, on top of `fallback` (the page's style
 * defaults). Anything missing or out of range keeps the fallback; returns
 * null when the query sets nothing at all.
 */
export function decodeState(query: URLSearchParams, styles: DielineStyle[], fallback: GeneratorState): GeneratorState | null {
  if (!hasState(query)) return null;
  const style = styles.find(item => item.id === query.get('style')) ?? styles.find(item => item.id === fallback.style);
  if (!style) return null;
  const base = style.id === fallback.style ? fallback : defaultState(style, fallback.units);
  const units: Units = query.get('u') === 'in' ? 'in' : query.get('u') === 'mm' ? 'mm' : base.units;
  const limit = units === 'in' ? MAX_MM / MM_PER_IN : MAX_MM;
  const size = (key: string, current: number) => {
    const raw = query.get(key);
    const value = raw === null || raw === '' ? NaN : Number(raw);
    return Number.isFinite(value) && value > 0 && value <= limit ? value : convert(current, base.units, units);
  };
  const thicknessValue = Number(query.get('t'));
  const thickness = Number.isFinite(thicknessValue) && thicknessValue >= 0.1 && thicknessValue <= 10 ? thicknessValue : base.thickness;
  const modeValue = query.get('mode') as DimensionMode;
  const material = query.get('mat');
  const keysOfStyle = new Set(style.params.map(param => param.key));
  const options: Record<string, number> = {};
  for (const [key, raw] of query) {
    const name = key.slice(2), value = Number(raw);
    if (key.startsWith('o_') && keysOfStyle.has(name) && raw !== '' && Number.isFinite(value) && value >= 0 && value <= limit) options[name] = value;
  }
  return {
    style: style.id,
    length: size('l', base.length), width: size('w', base.width), depth: size('d', base.depth),
    units,
    mode: MODES.includes(modeValue) ? modeValue : base.mode,
    material: material === CUSTOM_MATERIAL || MATERIALS.some(item => item.id === material) ? material! : materialFor(thickness),
    thickness,
    options,
  };
}

/** A file name for a download: style, size and unit. */
export function exportName(state: GeneratorState, extension: string, suffix = '') {
  const size = [state.length, state.width, state.depth].map(value => String(value).replace('.', '_')).join('x');
  return `${state.style}-${size}${state.units}${suffix}-dieline.${extension}`;
}
