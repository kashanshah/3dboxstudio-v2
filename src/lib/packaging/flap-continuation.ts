// How a panel with no artwork of its own continues a neighbour's: the strip of
// the neighbour's artwork along their shared crease is carried across the
// panel, the way printers extend artwork over a fold. Nothing is mirrored, so
// no text or logo ever shows reversed. The 2D grid, the 3D model and the
// print file all use these same numbers.

export type Box = { x: number; y: number; width: number; height: number };
/**
 * A crease on the sheet: horizontal (at y) or vertical (at x); side is +1 when
 * the continuing panel lies on the greater side of it, else -1.
 */
export type Crease = { axis: 'x' | 'y'; at: number; side: 1 | -1 };
export type Continuation<T> = { source: T; crease: Crease; stretch: number };

/** Width of the source's edge strip that is carried across, in millimetres. */
export const EDGE_STRIP_MM = 0.5;
/** The strip starts this far inside the source, clear of its very edge. */
export const EDGE_INSET_MM = 0.5;

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
    const crease: Crease = { ...line, side: centre > line.at ? 1 : -1 };
    // The whole panel maps into the edge strip, so its far edge lands
    // EDGE_STRIP_MM inside the source.
    const far = crease.axis === 'y'
      ? Math.max(Math.abs(panel.y - crease.at), Math.abs(panel.y + panel.height - crease.at))
      : Math.max(Math.abs(panel.x - crease.at), Math.abs(panel.x + panel.width - crease.at));
    result.push({ source: next, crease, stretch: Math.max(1, far / EDGE_STRIP_MM) });
    seen.add(next.id);
    previous = next;
  }
  return result;
}

/** The point of the source's artwork that shows at sheet point `point`. */
export function continuedPoint(point: { x: number; y: number }, crease: Crease, stretch: number) {
  const carry = (value: number) => crease.at - crease.side * EDGE_INSET_MM - (value - crease.at) / stretch;
  return crease.axis === 'y' ? { x: point.x, y: carry(point.y) } : { x: carry(point.x), y: point.y };
}

/**
 * The same mapping the other way, as a transform that draws the source's
 * artwork where it shows: content at sheet coordinate c lands at
 * offset - scale·c along the crease's axis (with scale = stretch).
 */
export function continuationTransform(crease: Crease, stretch: number) {
  return { scale: stretch, offset: (1 + stretch) * crease.at - crease.side * stretch * EDGE_INSET_MM };
}
