import type { PointMm } from './export-geometry';

/**
 * Where a shaped panel's name goes on the design grid, as fractions of its
 * bounding box: the shape's area centroid, when that sits well away from the
 * box's centre (a triangular glue tab, a flap cut off at 45°). Otherwise null,
 * and the name stays centred. Symmetric flaps such as dust flaps keep theirs.
 */
export function panelLabelAnchor(outline: PointMm[], box: { x: number; y: number; width: number; height: number }): { x: number; y: number } | null {
  let area = 0, cx = 0, cy = 0;
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  });
  if (Math.abs(area) < 1e-9 || box.width <= 0 || box.height <= 0) return null;
  const x = (cx / (3 * area) - box.x) / box.width, y = (cy / (3 * area) - box.y) / box.height;
  return Math.abs(x - 0.5) > 0.08 || Math.abs(y - 0.5) > 0.08 ? { x, y } : null;
}
