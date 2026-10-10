import { sanitizeCartonDimensions, type CartonDimensions } from '../reverse-tuck';
import { arcPoints, finishExportGeometry, rectangleOutline, type ExportPanel, type LineMm, type PointMm } from '../export-geometry';

// Tuck end cartons as die makers draw them today (ECMA A20.20 reverse tuck,
// A15.20 straight tuck): one strip of glue flap, left, front, right and back,
// a lid at each end hinged on one of the four walls with a tuck tongue, and a
// dust flap on each of the two walls beside it. The entered width, depth and
// height are the inside of the carton; each panel is creased one board
// thickness wider so the folded carton keeps that inside. The closures lock:
// slits at the tuck creases catch on the dust flaps' shoulders, the dust
// flaps crease one board below the lid so it closes flat over them, and the
// wall the tuck slides into is cut one board short, with a thumb notch at
// the top.

export type TuckWall = 'front' | 'back' | 'left' | 'right';
export type TuckEndLids = {
  /** The wall each lid is hinged on. */
  top: TuckWall;
  bottom: TuckWall;
  /** Artwork placed on a lid alone is turned this much on the sheet. */
  topRotation?: 0 | 180;
  bottomRotation?: 0 | 180;
};

const OPPOSITE: Record<TuckWall, TuckWall> = { front: 'back', back: 'front', left: 'right', right: 'left' };
const BESIDE: Record<TuckWall, TuckWall[]> = { front: ['left', 'right'], back: ['left', 'right'], left: ['front', 'back'], right: ['front', 'back'] };
const WALLS: TuckWall[] = ['left', 'right', 'front', 'back'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const titleLabel = (id: string) => id.replace(/-/g, ' ').toUpperCase().replace(/ DUST$/, ' DUST FLAP');

/** Sizes shared by every lid: crease-to-crease walls and the glue flap. */
export function tuckEndBodySizes(d: CartonDimensions) {
  const t = d.thickness;
  const glue = clamp(0.3 * Math.min(d.width, d.depth) + 4, 10, 15);
  return {
    t,
    // The back, which the glue flap is stuck to, takes half a board less.
    walls: { front: d.width + t, back: d.width + t / 2, left: d.depth + t, right: d.depth + t } as Record<TuckWall, number>,
    /** Inside width of each wall. */
    inside: { front: d.width, back: d.width, left: d.depth, right: d.depth } as Record<TuckWall, number>,
    height: d.height + t,
    glue,
    glueSetback: t + 1,
    glueTaper: glue * Math.tan(15 * Math.PI / 180),
    dustRelief: t + 0.5,
    tuckInset: t + 0.5,
  };
}

/** The lid on `wall`: its tuck tongue and the dust flaps beside it. */
export function tuckEndLidSizes(d: CartonDimensions, wall: TuckWall) {
  const body = tuckEndBodySizes(d);
  const { t } = body;
  const width = body.walls[wall], insideWidth = body.inside[wall];
  // The lid reaches across the opening to the opposite wall.
  const insideLength = wall === 'front' || wall === 'back' ? d.depth : d.width;
  const length = insideLength + t;
  // The tuck tongue slides down inside the opposite wall.
  const tongue = Math.max(4, Math.min(clamp(0.4 * insideLength, 12, 25), d.height / 3));
  const shoulder = Math.min(3, tongue / 3);
  const radius = Math.max(1, Math.min(clamp(0.6 * tongue, 5, 15), tongue - shoulder, (width - 2 * body.tuckInset) / 2 - 1));
  const slit = Math.max(body.tuckInset + 1, Math.min(clamp(0.04 * insideWidth, 3, 6), width / 4));
  return { width, insideWidth, length, tongue, shoulder, radius, slit };
}

/** A dust flap on `wall` beside a lid of inside width `lidInsideWidth`. */
function dustSizes(d: CartonDimensions, wall: TuckWall, lidInsideWidth: number) {
  const body = tuckEndBodySizes(d);
  // Dust flaps leave room between their tips across the opening.
  const height = Math.max(4, Math.min(lidInsideWidth / 2 - body.t - 1.5, Math.max(0.6 * body.inside[wall], 12)));
  const shoulder = Math.min(3, height / 3);
  const taper = Math.max(0, Math.min((height - shoulder) * Math.tan(20 * Math.PI / 180), (body.walls[wall] - 2 * body.dustRelief) / 2 - 2));
  return { height, shoulder, taper };
}

/** The cutting template's panels, outlines, creases and cuts. */
export function tuckEndSheet(input: CartonDimensions, lids: TuckEndLids, notes: string[]) {
  const d = sanitizeCartonDimensions(input);
  const body = tuckEndBodySizes(d);
  const { t } = body;
  const lid = { top: tuckEndLidSizes(d, lids.top), bottom: tuckEndLidSizes(d, lids.bottom) };
  const dust = (end: 'top' | 'bottom', wall: TuckWall) => dustSizes(d, wall, lid[end].insideWidth);
  const topDust = Math.max(...BESIDE[lids.top].map(wall => dust('top', wall).height));
  const top = Math.max(lid.top.tongue + lid.top.length, topDust);
  const bottomCrease = top + body.height;
  const x: Record<TuckWall, number> = { left: body.glue, front: 0, right: 0, back: 0 };
  x.front = x.left + body.walls.left;
  x.right = x.front + body.walls.front;
  x.back = x.right + body.walls.right;
  // Each wall runs from crease to crease where its lid hinges, and stops one
  // board short at an end where it has a dust flap or takes the tuck.
  const wallTop = (wall: TuckWall) => top + (wall === lids.top ? 0 : t);
  const wallBottom = (wall: TuckWall) => bottomCrease - (wall === lids.bottom ? 0 : t);

  const panels: ExportPanel[] = [];
  const slits: LineMm[] = [];
  const add = (id: string, kind: ExportPanel['kind'], outline: PointMm[], fold?: PointMm[]) => {
    const xs = outline.map(point => point.x), ys = outline.map(point => point.y);
    const left = Math.min(...xs), y = Math.min(...ys);
    const panel: ExportPanel = {
      id, label: titleLabel(id), kind, sourceId: id,
      x: left, y, width: Math.max(...xs) - left, height: Math.max(...ys) - y, outline,
    };
    if (fold) panel.fold = fold;
    panels.push(panel);
    return panel;
  };
  const rect = (left: number, y: number, width: number, height: number) => rectangleOutline({ x: left, y, width, height } as ExportPanel);

  const glueTop = wallTop('left') + body.glueSetback, glueBottom = wallBottom('left') - body.glueSetback;
  add('glue', 'glue', [
    { x: body.glue, y: glueTop }, { x: body.glue, y: glueBottom },
    { x: 0, y: glueBottom - body.glueTaper }, { x: 0, y: glueTop + body.glueTaper },
  ]);
  // The wall the top tuck slides into has a thumb notch to open the carton.
  const notched = OPPOSITE[lids.top];
  for (const wall of WALLS.slice().sort((a, b) => x[a] - x[b])) {
    const y0 = wallTop(wall), y1 = wallBottom(wall), width = body.walls[wall];
    const outline = rect(x[wall], y0, width, y1 - y0);
    if (wall !== notched) { add(wall, 'body', outline); continue; }
    const radius = Math.min(10, body.inside[wall] / 6), centre = x[wall] + width / 2;
    add(wall, 'body', [
      { x: x[wall], y: y0 }, ...arcPoints(centre, y0, radius, Math.PI, 0, 12),
      ...outline.slice(1),
    ], outline);
  }
  const topLid = add('top', 'flap', rect(x[lids.top], top - lid.top.length, lid.top.width, lid.top.length));
  if (lids.topRotation) topLid.artworkRotation = lids.topRotation;
  const bottomLid = add('bottom', 'flap', rect(x[lids.bottom], bottomCrease, lid.bottom.width, lid.bottom.length));
  if (lids.bottomRotation) bottomLid.artworkRotation = lids.bottomRotation;

  for (const [id, end, hingeY, direction] of [
    ['top-tuck', 'top', top - lid.top.length, -1],
    ['bottom-tuck', 'bottom', bottomCrease + lid.bottom.length, 1],
  ] as const) {
    const { width, tongue, shoulder, radius, slit } = lid[end];
    const left = x[lids[end]];
    const l = left + body.tuckInset, r = left + width - body.tuckInset, tip = hingeY + direction * tongue;
    const up = direction === -1;
    // Straight shoulders below the crease, then rounded corners to the tip.
    const outline: PointMm[] = [
      { x: l, y: hingeY }, { x: r, y: hingeY },
      { x: r, y: hingeY + direction * shoulder },
      ...arcPoints(r - radius, tip - direction * radius, radius, 0, up ? -Math.PI / 2 : Math.PI / 2),
      ...arcPoints(l + radius, tip - direction * radius, radius, up ? -Math.PI / 2 : Math.PI / 2, up ? -Math.PI : Math.PI),
      { x: l, y: hingeY + direction * shoulder },
    ];
    const bevel = radius * (1 - Math.SQRT1_2);
    add(id, 'flap', outline, [{ x: l, y: hingeY }, { x: r, y: hingeY }, { x: r - bevel, y: tip }, { x: l + bevel, y: tip }]);
    // Slit locks: the crease stops short of the tuck's ends.
    slits.push(
      { start: { x: l, y: hingeY }, end: { x: left + slit, y: hingeY } },
      { start: { x: left + width - slit, y: hingeY }, end: { x: r, y: hingeY } },
    );
  }
  for (const wall of WALLS) {
    for (const end of ['top', 'bottom'] as const) {
      if (!BESIDE[lids[end]].includes(wall)) continue;
      const { height, shoulder, taper } = dust(end, wall);
      const direction = end === 'top' ? -1 : 1, hingeY = end === 'top' ? wallTop(wall) : wallBottom(wall);
      const l = x[wall] + body.dustRelief, r = x[wall] + body.walls[wall] - body.dustRelief, tip = hingeY + direction * height;
      // A straight shoulder that the tuck's slit catches on, then a taper.
      add(`${end}-${wall}-dust`, 'flap', [
        { x: l, y: hingeY }, { x: r, y: hingeY },
        { x: r, y: hingeY + direction * shoulder }, { x: r - taper, y: tip },
        { x: l + taper, y: tip }, { x: l, y: hingeY + direction * shoulder },
      ], [{ x: l, y: hingeY }, { x: r, y: hingeY }, { x: r - taper, y: tip }, { x: l + taper, y: tip }]);
    }
  }
  return finishExportGeometry(panels, 'cutting-template', notes, { slits });
}

/** Size checks every tuck end carton shares, with what to change. */
export function checkTuckEndSize(input: CartonDimensions) {
  const d = sanitizeCartonDimensions(input);
  if (d.width < 20) throw new Error('The width is too small for the glue flap, tucks and thumb notch. Use a width of at least 20 mm.');
  if (d.depth < 10) throw new Error('The depth is too small for the glue flap and tuck. Use a depth of at least 10 mm.');
  // The tuck tongue is at most a third of the height and needs about 8 mm to lock.
  if (d.height < 24) throw new Error('The height is too small for the tuck tongues to lock. Use a height of at least 24 mm.');
  return d;
}

/**
 * How far the tuck tongue is curled, given how far it has been pre-folded and
 * how far the lid (depth `depth`) has swung from upright (0) to closed (π/2),
 * keeping the tip `clearance` inside the opposite wall.
 * While the lid comes down, the tongue is curled past square just enough for
 * its tip to clear the opposite panel, then springs back to square inside it.
 */
export function tongueAngle(prefold: number, lid: number, depth: number, tongue: number, clearance: number) {
  if (tongue <= 0) return prefold;
  // Tip distance beyond the lid's free edge, toward the opposite panel, is
  // tongue·sin(lid + curl); it must stay within the room left, depth·(1 − sin lid).
  const room = Math.max(-1, Math.min(1, (depth * (1 - Math.sin(lid)) - clearance) / tongue));
  const needed = Math.PI - lid - Math.asin(room);
  return Math.min(Math.PI * 0.85, Math.max(prefold, prefold > 0 ? needed : 0));
}
