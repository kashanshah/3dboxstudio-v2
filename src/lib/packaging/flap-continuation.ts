// How a panel with no artwork of its own continues a neighbour's: it is
// printed solid in the colour that dominates the neighbour's artwork along
// their shared crease, the way printers run a background over a fold. Text
// and logos near the crease are never smeared or mirrored onto the flap. The
// 2D grid, the 3D model and the print file all use these same rules.

export type Box = { x: number; y: number; width: number; height: number };
/**
 * A crease on the sheet: horizontal (at y) or vertical (at x); side is +1 when
 * the continuing panel lies on the greater side of it, else -1.
 */
export type Crease = { axis: 'x' | 'y'; at: number; side: 1 | -1 };
export type Continuation<T> = { source: T; crease: Crease };

/** How deep into the source the edge colour is read, in millimetres. */
export const EDGE_BAND_MM = 8;

export function creaseBetween(panel: Box, source: Box): Omit<Crease, 'side'> | null {
  const eps = 1e-6;
  const overlapX = Math.min(panel.x + panel.width, source.x + source.width) - Math.max(panel.x, source.x);
  const overlapY = Math.min(panel.y + panel.height, source.y + source.height) - Math.max(panel.y, source.y);
  if (overlapX > eps && Math.abs(panel.y + panel.height - source.y) < eps) return { axis: 'y', at: source.y };
  if (overlapX > eps && Math.abs(source.y + source.height - panel.y) < eps) return { axis: 'y', at: panel.y };
  if (overlapY > eps && Math.abs(panel.x + panel.width - source.x) < eps) return { axis: 'x', at: source.x };
  if (overlapY > eps && Math.abs(source.x + source.width - panel.x) < eps) return { axis: 'x', at: panel.x };
  return null;
}

/**
 * The panels `panel` can continue, nearest first: its source, then that
 * source's own source while the creases run the same way (a tuck flap under
 * an empty bottom continues the back the bottom hangs from).
 */
export function continuationChain<T extends Box & { id: string }>(panel: T, sourceOf: (id: string) => T | undefined): Continuation<T>[] {
  const result: Continuation<T>[] = [];
  const seen = new Set([panel.id]);
  let previous: T = panel;
  for (let next = sourceOf(panel.id); next && !seen.has(next.id); next = sourceOf(next.id)) {
    const line = creaseBetween(previous, next);
    if (!line || (result.length && line.axis !== result[0].crease.axis)) break;
    const centre = line.axis === 'y' ? panel.y + panel.height / 2 : panel.x + panel.width / 2;
    result.push({ source: next, crease: { ...line, side: centre > line.at ? 1 : -1 } });
    seen.add(next.id);
    previous = next;
  }
  return result;
}

/**
 * The strip of `source` along `crease` whose colour a flap takes, in sheet
 * millimetres: EDGE_BAND_MM deep, or a third of the source if that is less.
 */
export function edgeBand(source: Box, crease: Crease): Box {
  if (crease.axis === 'y') {
    const depth = Math.min(EDGE_BAND_MM, source.height / 3);
    return { x: source.x, y: crease.side > 0 ? crease.at - depth : crease.at, width: source.width, height: depth };
  }
  const depth = Math.min(EDGE_BAND_MM, source.width / 3);
  return { x: crease.side > 0 ? crease.at - depth : crease.at, y: source.y, width: depth, height: source.height };
}

/**
 * The colour that covers most of an RGBA pixel run, as "#rrggbb", or null when
 * mostly transparent pixels win (the flap then stays plain board). Colours are
 * grouped coarsely so anti-aliasing and photo noise vote together; the result
 * is the average of the winning group.
 */
export function dominantColour(data: ArrayLike<number>): string | null {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  let clear = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) { clear++; continue; }
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r >> 4) << 8 | (g >> 4) << 4 | b >> 4;
    const bin = counts.get(key);
    if (bin) { bin.n++; bin.r += r; bin.g += g; bin.b += b; }
    else counts.set(key, { n: 1, r, g, b });
  }
  let best: { n: number; r: number; g: number; b: number } | undefined;
  for (const bin of counts.values()) if (!best || bin.n > best.n) best = bin;
  if (!best || clear >= best.n) return null;
  const hex = (value: number) => Math.round(value / best!.n).toString(16).padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}
