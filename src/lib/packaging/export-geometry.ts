import type { DielinePanel } from './box-structures';

export type PointMm = { x: number; y: number };
export type LineMm = { start: PointMm; end: PointMm };
export type ExportPanel = DielinePanel & { outline: PointMm[]; sourceId?: string; sourceRotation?: number };
export type DielineExportGeometry = {
  panels: ExportPanel[];
  cut: LineMm[];
  crease: LineMm[];
  bounds: { width: number; height: number };
  kind: 'cutting-template' | 'layout-proof';
  notes: string[];
};

export function rectangleOutline(panel: DielinePanel): PointMm[] {
  const { x, y, width: w, height: h } = panel;
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

const epsilon = 1e-7;
const near = (a: number, b: number) => Math.abs(a - b) < epsilon;
function sharedSegment(a: LineMm, b: LineMm): LineMm | null {
  const vertical = near(a.start.x, a.end.x) && near(b.start.x, b.end.x) && near(a.start.x, b.start.x);
  const horizontal = near(a.start.y, a.end.y) && near(b.start.y, b.end.y) && near(a.start.y, b.start.y);
  if (!vertical && !horizontal) return slantedSharedSegment(a, b);
  const axis = vertical ? 'y' : 'x';
  const start = Math.max(Math.min(a.start[axis], a.end[axis]), Math.min(b.start[axis], b.end[axis]));
  const end = Math.min(Math.max(a.start[axis], a.end[axis]), Math.max(b.start[axis], b.end[axis]));
  if (end - start < epsilon) return null;
  return vertical
    ? { start: { x: a.start.x, y: start }, end: { x: a.start.x, y: end } }
    : { start: { x: start, y: a.start.y }, end: { x: end, y: a.start.y } };
}

const isAxisAligned = (line: LineMm) => near(line.start.x, line.end.x) || near(line.start.y, line.end.y);
/** Distance along `line` from its start, and across it, of `point`. */
function along(line: LineMm, point: PointMm) {
  const dx = line.end.x - line.start.x, dy = line.end.y - line.start.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length, uy = dy / length;
  const px = point.x - line.start.x, py = point.y - line.start.y;
  return { at: px * ux + py * uy, off: Math.abs(px * uy - py * ux), length, point: (at: number) => ({ x: line.start.x + ux * at, y: line.start.y + uy * at }) };
}

/** The part two slanted edges share (a 45° glue tab's crease), or null. */
function slantedSharedSegment(a: LineMm, b: LineMm): LineMm | null {
  if (isAxisAligned(a) || isAxisAligned(b)) return null;
  const tolerance = 1e-6;
  const p = along(a, b.start), q = along(a, b.end);
  if (p.off > tolerance || q.off > tolerance) return null;
  const start = Math.max(0, Math.min(p.at, q.at)), end = Math.min(p.length, Math.max(p.at, q.at));
  if (end - start < epsilon) return null;
  return { start: p.point(start), end: p.point(end) };
}

function subtract(line: LineMm, folds: LineMm[]): LineMm[] {
  let remaining = [line];
  for (const fold of folds) {
    remaining = remaining.flatMap(part => {
      const overlap = sharedSegment(part, fold);
      if (!overlap) return [part];
      if (!isAxisAligned(part)) {
        const a = along(part, overlap.start).at, b = along(part, overlap.end).at;
        const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
        const length = along(part, part.end).at;
        const result: LineMm[] = [];
        if (lo > epsilon) result.push({ start: part.start, end: along(part, part.start).point(lo) });
        if (length - hi > epsilon) result.push({ start: along(part, part.start).point(hi), end: part.end });
        return result;
      }
      const axis = near(part.start.x, part.end.x) ? 'y' : 'x';
      const [start, end] = part.start[axis] < part.end[axis] ? [part.start, part.end] : [part.end, part.start];
      const result: LineMm[] = [];
      if (overlap.start[axis] - start[axis] > epsilon) result.push({ start, end: overlap.start });
      if (end[axis] - overlap.end[axis] > epsilon) result.push({ start: overlap.end, end });
      return result;
    });
  }
  return remaining;
}

function unique(lines: LineMm[]) {
  const key = (point: PointMm) => `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
  return Array.from(new Map(lines.map(line => [[key(line.start), key(line.end)].sort().join('|'), line])).values());
}

/**
 * Points along a circular arc from angle `from` to `to` (radians, y down),
 * both ends included; die lines approximate curves with short straight cuts.
 */
export function arcPoints(cx: number, cy: number, r: number, from: number, to: number, segments = 8): PointMm[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = from + (to - from) * i / segments;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

export type ExportDetails = {
  /** Cuts along a crease line (tuck slit locks): never creased. */
  slits?: LineMm[];
  /** Cuts inside panels (slots, vents). */
  cuts?: LineMm[];
};

/** Shared panel edges are folds; only the remaining exterior edges are cuts. */
export function finishExportGeometry(panels: ExportPanel[], kind: DielineExportGeometry['kind'], notes: string[], details: ExportDetails = {}): DielineExportGeometry {
  const edges = panels.flatMap((panel, owner) => panel.outline.map((start, i) => ({
    owner, start, end: panel.outline[(i + 1) % panel.outline.length],
  })));
  const shared: LineMm[] = [];
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    if (edges[i].owner === edges[j].owner) continue;
    const overlap = sharedSegment(edges[i], edges[j]);
    if (overlap) shared.push(overlap);
  }
  const slits = details.slits ?? [];
  const crease = unique(shared).flatMap(line => subtract(line, slits));
  return {
    panels, kind, notes, crease,
    cut: unique([...edges.flatMap(edge => subtract(edge, crease)), ...(details.cuts ?? [])]),
    bounds: {
      width: Math.max(...panels.flatMap(panel => panel.outline.map(point => point.x))),
      height: Math.max(...panels.flatMap(panel => panel.outline.map(point => point.y))),
    },
  };
}

export function layoutProofGeometry(panels: DielinePanel[]) {
  return finishExportGeometry(panels.map(panel => ({ ...panel, sourceId: panel.id, outline: rectangleOutline(panel) })), 'layout-proof', [
    'Layout proof only: closure and manufacturing details are not defined for this template.',
    'Nominal face sizes; no material or crease compensation. Obtain printer approval before production.',
  ]);
}
