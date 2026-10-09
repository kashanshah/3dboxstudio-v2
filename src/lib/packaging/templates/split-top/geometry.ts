import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { sanitizeCorrugatedDimensions } from '../corrugated';
import { finishExportGeometry, rectangleOutline, type ExportPanel, type PointMm } from '@/lib/packaging/export-geometry';

// The split top is a regular slotted container (FEFCO 0201), the everyday
// corrugated shipping box: one strip of joint, front, right, back and left,
// with a flap on every wall at each end. Slots cut between the flaps let them
// fold past each other. The outer pair of top flaps meet in the middle and
// split the top in two; with them on the end walls, the end flaps are half
// the width long and both pairs meet (FEFCO 0204, centre special slotted).
// Width, depth and height are inside sizes; each panel is scored one board
// wider, the height two boards taller, so the folded box keeps them.

export type SplitTopSide = 'side_a' | 'side_b';

export function sanitizeSplitTopDimensions(value: CartonDimensions): CartonDimensions {
  return sanitizeCorrugatedDimensions(value, 3);
}

export function splitTopSizes(d: CartonDimensions) {
  const t = d.thickness;
  const corrugated = t >= 1.5;
  // Slots: about 6 mm on single-wall corrugated, wider on double wall; a
  // board and a millimetre on folding board, at least the 3 mm a score bends
  // through so neighbouring flaps clear each other.
  const slot = corrugated ? Math.max(6, 2 * t) : Math.max(3, t + 1);
  // The manufacturer's joint: 30-40 mm on corrugated, 12-15 mm on board.
  const joint = corrugated ? 35 : 14;
  return {
    t, slot, joint,
    jointCutBack: slot / 2,
    jointTaper: Math.min(joint, 10),
    long: d.width + t,
    end: d.depth + t,
    // The end wall the joint is stuck to takes half a board less.
    jointEnd: d.depth + t / 2,
    height: d.height + 2 * t,
  };
}

const LABELS: Record<string, string> = {
  topFront: 'TOP FRONT', topRight: 'TOP RIGHT', topBack: 'TOP BACK', topLeft: 'TOP LEFT',
  bottomFront: 'BOTTOM FRONT', bottomRight: 'BOTTOM RIGHT', bottomBack: 'BOTTOM BACK', bottomLeft: 'BOTTOM LEFT',
};

/** The cutting template's panels, outlines, scores and cuts. */
export function splitTopSheet(input: CartonDimensions, side: SplitTopSide = 'side_a') {
  const d = sanitizeSplitTopDimensions(input);
  const s = splitTopSizes(d);
  const walls = [
    { id: 'front', width: s.long, end: false },
    { id: 'right', width: s.end, end: true },
    { id: 'back', width: s.long, end: false },
    { id: 'left', width: s.jointEnd, end: true },
  ];
  // Every flap is half the end wall long, so the long walls' flaps meet in
  // the middle; with the outer flaps on the end walls (0204), theirs are half
  // the long wall and meet too.
  const flapHeight = (end: 'top' | 'bottom', isEnd: boolean) => (end === 'top' && side === 'side_a' && isEnd ? s.long / 2 : s.end / 2);
  const top = Math.max(...walls.map(wall => flapHeight('top', wall.end)));
  const bottom = top + s.height;
  const panels: ExportPanel[] = [];
  const add = (id: string, kind: ExportPanel['kind'], outline: PointMm[]) => {
    const xs = outline.map(point => point.x), ys = outline.map(point => point.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    panels.push({ id, label: LABELS[id] ?? id.toUpperCase(), kind, sourceId: id, x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, outline });
  };
  add('glue', 'glue', [
    { x: s.joint, y: top + s.jointCutBack }, { x: s.joint, y: bottom - s.jointCutBack },
    { x: 0, y: bottom - s.jointCutBack - s.jointTaper }, { x: 0, y: top + s.jointCutBack + s.jointTaper },
  ]);
  let x = s.joint;
  walls.forEach(wall => {
    add(wall.id, 'body', rectangleOutline({ x, y: top, width: wall.width, height: s.height } as ExportPanel));
    // A slot either side of every flap, half on each neighbour, including at
    // the glued corner where the strip's two ends meet.
    const left = x + s.slot / 2, right = x + wall.width - s.slot / 2;
    for (const end of ['top', 'bottom'] as const) {
      const h = flapHeight(end, wall.end), hinge = end === 'top' ? top : bottom, tip = end === 'top' ? top - h : bottom + h;
      add(`${end}${wall.id[0].toUpperCase()}${wall.id.slice(1)}`, 'flap', [
        { x: left, y: hinge }, { x: right, y: hinge }, { x: right, y: tip }, { x: left, y: tip },
      ]);
    }
    x += wall.width;
  });
  return finishExportGeometry(panels, 'cutting-template', [
    side === 'side_b'
      ? 'Regular slotted container (FEFCO 0201): four flaps at each end, slotted, with a glued manufacturer\'s joint.'
      : 'Centre special slotted container (FEFCO 0204): every top flap meets in the middle; regular slotted bottom.',
    `Width, depth and height are inside sizes; panels are scored one board (${s.t} mm) wider and the height two boards taller. Ask your box maker to confirm the allowances for the flute you choose.`,
    'Artwork prints exactly as laid out on the design grid, including the flaps.',
  ]);
}

/** The printable cutting template, with the size checks. */
export function splitTopExportGeometry(input: CartonDimensions, side: SplitTopSide = 'side_a') {
  const d = sanitizeSplitTopDimensions(input);
  const s = splitTopSizes(d);
  if (d.depth < s.joint + 5) throw new Error(`The depth is too small for the glued joint. Use a depth of at least ${s.joint + 5} mm on this board.`);
  if (d.width < s.joint + 5) throw new Error(`The width is too small for the slotted flaps. Use a width of at least ${s.joint + 5} mm on this board.`);
  if (d.height < 2 * s.slot + 10) throw new Error(`The height is too small for this board. Use a height of at least ${2 * s.slot + 10} mm.`);
  return splitTopSheet(d, side);
}
