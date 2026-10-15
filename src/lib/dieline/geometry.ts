// Plane geometry for dielines: joining loose line segments into paths,
// finding the sheet's outer contour, and offsetting outlines for bleed and
// safe zones. All in millimetres, y down.

export type Point = [number, number];
export type Segment = [Point, Point];

const key = ([x, y]: Point) => `${x.toFixed(3)},${y.toFixed(3)}`;
const round = (value: number) => Number(value.toFixed(3));

/**
 * Joins segments that share end points into polylines: closed loops where
 * the lines go all the way round (the first point is repeated at the end),
 * open runs otherwise. A die maker's file reads far better as a few long
 * paths than as hundreds of loose lines.
 */
export function chainSegments(segments: Segment[]): Point[][] {
  const unused = new Set(segments.map((_, index) => index));
  const at = new Map<string, number[]>();
  segments.forEach(([a, b], index) => {
    for (const point of [a, b]) at.set(key(point), [...(at.get(key(point)) ?? []), index]);
  });
  const next = (point: Point) => (at.get(key(point)) ?? []).find(index => unused.has(index));
  const runs: Point[][] = [];
  // Start open runs at their ends (points with an odd number of segments), then close the loops left.
  const starts = [...at.entries()].filter(([, list]) => list.length % 2 === 1).map(([text]) => text);
  const walk = (start: Point) => {
    const run: Point[] = [start];
    let point = start;
    for (let index = next(point); index !== undefined; index = next(point)) {
      unused.delete(index);
      const [a, b] = segments[index];
      point = key(a) === key(point) ? b : a;
      run.push(point);
    }
    return run;
  };
  for (const start of starts) {
    const index = next(start.split(',').map(Number) as Point);
    if (index === undefined) continue;
    const [a, b] = segments[index];
    runs.push(walk(key(a) === start ? a : b));
  }
  for (const index of [...unused]) {
    if (!unused.has(index)) continue;
    runs.push(walk(segments[index][0]));
  }
  return runs.filter(run => run.length > 1);
}

export const isClosed = (run: Point[]) => run.length > 3 && key(run[0]) === key(run[run.length - 1]);

/** SVG path data for polylines, closing loops with Z. */
export function pathData(runs: Point[][]): string {
  return runs.map(run => {
    const closed = isClosed(run);
    const points = closed ? run.slice(0, -1) : run;
    return `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}${closed ? 'Z' : ''}`;
  }).join('');
}

/** Signed area (positive clockwise on the sheet, where y points down). */
export function signedArea(polygon: Point[]) {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i], [x1, y1] = polygon[(i + 1) % polygon.length];
    area += x0 * y1 - x1 * y0;
  }
  return area / 2;
}

/**
 * The outline of each piece of the sheet: the cut lines that lie on exactly
 * one panel's edge. That leaves out slits (on the edge of two panels) and
 * holes cut inside a panel (on none), so each loop is a piece's boundary.
 */
export function pieceOutlines(cuts: Segment[], panels: Point[][]): Point[][] {
  const onEdge = (point: Point, outline: Point[]) => outline.some((a, i) => {
    const b = outline[(i + 1) % outline.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-9) return false;
    const along = ((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / length;
    const off = Math.abs((point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0])) / length;
    return off < 1e-3 && along > -1e-3 && along < length + 1e-3;
  });
  // Split each cut at the panel corners along it: a slit can run on past
  // the corner of a narrower panel into a stretch of plain edge.
  const corners = panels.flat();
  const pieces = cuts.flatMap(([a, b]): Segment[] => {
    const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
    if (length2 < 1e-12) return [];
    const stops = corners.map(point => ({ point, t: ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2 }))
      .filter(({ point, t }) => t > 1e-6 && t < 1 - 1e-6 && Math.abs((point[0] - a[0]) * dy - (point[1] - a[1]) * dx) / Math.sqrt(length2) < 1e-3)
      .sort((p, q) => p.t - q.t).map(({ t }): Point => [a[0] + dx * t, a[1] + dy * t]);
    const points = [a, ...stops, b];
    return points.slice(1).map((point, i): Segment => [points[i], point]);
  });
  const boundary = pieces.filter(([a, b]) => {
    const middle: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return panels.filter(outline => onEdge(middle, outline)).length === 1;
  });
  return chainSegments(boundary).filter(isClosed).map(run => run.slice(0, -1));
}

/**
 * The outline moved `distance` outwards (negative: inwards) with mitred
 * corners, the mitre capped at three times the distance so sharp notches
 * don't throw spikes. Good for guide lines (bleed, safe zones), not for cuts.
 */
export function offsetPolygon(polygon: Point[], distance: number): Point[] {
  const points = dedupe(polygon);
  const n = points.length;
  if (n < 3) return points;
  // Which side of travel is outside depends on the outline's winding.
  const sign = signedArea(points) > 0 ? 1 : -1;
  const normal = (a: Point, b: Point): Point => {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
    return [sign * dy / length, -sign * dx / length];
  };
  return points.map((point, i) => {
    const before = normal(points[(i - 1 + n) % n], point), after = normal(point, points[(i + 1) % n]);
    const mx = before[0] + after[0], my = before[1] + after[1], m = Math.hypot(mx, my);
    if (m < 1e-9) return [point[0] + before[0] * distance, point[1] + before[1] * distance];
    // The mitre's length grows as the corner sharpens; cap it.
    const cos = (mx / m) * after[0] + (my / m) * after[1];
    const reach = Math.min(Math.abs(distance) * 3, Math.abs(distance / Math.max(cos, 1e-6))) * Math.sign(distance);
    return [point[0] + (mx / m) * reach, point[1] + (my / m) * reach];
  });
}

function dedupe(polygon: Point[]): Point[] {
  const out: Point[] = [];
  for (const point of polygon) if (!out.length || key(out[out.length - 1]) !== key(point)) out.push(point);
  if (out.length > 1 && key(out[0]) === key(out[out.length - 1])) out.pop();
  return out;
}

/** The part of a parent's outline a child's outline shares, or null: the crease they fold about. */
export function sharedEdge(parent: Point[], child: Point[]): Segment | null {
  let best: Segment | null = null, bestLength = 1e-6;
  for (let i = 0; i < parent.length; i++) {
    const p0 = parent[i], p1 = parent[(i + 1) % parent.length];
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], length = Math.hypot(dx, dy);
    if (length < 1e-9) continue;
    const ux = dx / length, uy = dy / length;
    for (let j = 0; j < child.length; j++) {
      const c0 = child[j], c1 = child[(j + 1) % child.length];
      const off = (q: Point) => Math.abs((q[0] - p0[0]) * uy - (q[1] - p0[1]) * ux);
      if (off(c0) > 1e-4 || off(c1) > 1e-4) continue;
      const t0 = (c0[0] - p0[0]) * ux + (c0[1] - p0[1]) * uy, t1 = (c1[0] - p0[0]) * ux + (c1[1] - p0[1]) * uy;
      const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(length, Math.max(t0, t1));
      if (hi - lo > bestLength) {
        bestLength = hi - lo;
        best = [[round(p0[0] + ux * lo), round(p0[1] + uy * lo)], [round(p0[0] + ux * hi), round(p0[1] + uy * hi)]];
      }
    }
  }
  return best;
}

/** Whether a closed polygon crosses itself (two non-adjacent edges intersect). */
export function selfIntersects(polygon: Point[]): boolean {
  const points = dedupe(polygon), n = points.length;
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = points[j], d = points[(j + 1) % n];
      const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
      if (((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))) return true;
    }
  }
  return false;
}
