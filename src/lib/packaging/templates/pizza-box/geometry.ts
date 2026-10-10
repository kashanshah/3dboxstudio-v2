import type { CartonDimensions } from '../../reverse-tuck';
import { arcPoints, finishExportGeometry, rectangleOutline, type ExportPanel, type LineMm, type PointMm } from '../../export-geometry';
import { sanitizeCorrugatedDimensions } from '../corrugated';

// A one-piece corrugated pizza box as made today: no glue. The front wall is
// folded double over a narrow roll strip; its inner layer drops down inside
// and locks with two tabs into slots in the base, trapping the side walls'
// front corner tabs between the two layers. The side walls' back corner tabs
// fold inside the back wall. The lid hinges on the back wall; its front tuck
// slides down inside the front, its side flaps inside the side walls. A
// finger hole across the roll strip lifts the lid.
//
// Width (across the front), depth (front to back) and wall height are inside
// sizes; t is the board thickness.

export function sanitizePizzaBoxDimensions(value: CartonDimensions): CartonDimensions {
  return sanitizeCorrugatedDimensions(value, 1.5);
}

export function pizzaBoxSizes(d: CartonDimensions) {
  const t = d.thickness, clearance = 0.5;
  // The roll strip lets the inner layer drop one board inside the outer
  // one, with a corner tab's board between them.
  const roll = 2 * t;
  const innerHeight = d.height - t;
  const tab = { width: Math.min(40, Math.max(20, 0.12 * d.width)), height: Math.max(4, 2 * t + 1) };
  // Inner front: clear of the side walls by a board and a little play.
  const innerInset = t + clearance;
  // Corner tabs reach well into the front's double wall.
  const ear = Math.min(0.9 * d.height, d.width / 4);
  // Lid: rests on the walls; its flaps go down inside them.
  const lidDepth = d.depth - 2 * t;
  // The lid's front tuck stops short of the base, whatever the board.
  const lidTuck = d.height - 2 * t - 2;
  const lidFlap = d.height - 2 * t - clearance;
  const backHeight = d.height + t;
  const fingerHole = Math.min(12, d.height / 3, d.width / 10);
  return { t, clearance, roll, innerHeight, tab, innerInset, ear, lidDepth, lidTuck, lidFlap, backHeight, fingerHole };
}

const LABELS: Record<string, string> = {
  frontRoll: 'FRONT ROLL', frontInner: 'INNER FRONT',
  lidFront: 'LID FRONT', lidLeft: 'LID LEFT', lidRight: 'LID RIGHT',
  leftBackTab: 'LEFT BACK TAB', leftFrontTab: 'LEFT FRONT TAB', rightBackTab: 'RIGHT BACK TAB', rightFrontTab: 'RIGHT FRONT TAB',
};

/** The cutting template's panels, outlines, creases and cuts; also the design grid. */
export function pizzaBoxSheet(input: CartonDimensions) {
  const d = sanitizePizzaBoxDimensions(input);
  const s = pizzaBoxSizes(d);
  const { t } = s;
  const w = d.width, h = d.height;
  // Columns: left wall | base | right wall; rows: lid tuck, lid, back wall,
  // base, front wall, roll strip, inner front and its tabs.
  const x0 = Math.max(h, s.lidFlap);
  const lidTop = s.lidTuck, backTop = lidTop + s.lidDepth, y0 = backTop + s.backHeight;
  const frontTop = y0 + d.depth, rollTop = frontTop + h, innerTop = rollTop + s.roll;
  const panels: ExportPanel[] = [];
  const add = (id: string, kind: ExportPanel['kind'], outline: PointMm[], fold?: PointMm[], artworkRotation?: 180) => {
    const xs = outline.map(point => point.x), ys = outline.map(point => point.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    const panel: ExportPanel = { id, label: LABELS[id] ?? id.toUpperCase(), kind, sourceId: id, x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, outline };
    if (fold) panel.fold = fold;
    if (artworkRotation) panel.artworkRotation = artworkRotation;
    panels.push(panel);
    return panel;
  };
  const rect = (x: number, y: number, width: number, height: number) => rectangleOutline({ x, y, width, height } as ExportPanel);

  add('bottom', 'body', rect(x0, y0, w, d.depth));
  // The front wall, lid and lid front sit upside down on the sheet relative
  // to the folded box: artwork placed on one of them alone is turned to read
  // upright on the box.
  add('front', 'body', rect(x0, frontTop, w, h), undefined, 180);
  const inL = x0 + s.innerInset, inR = x0 + w - s.innerInset;
  add('frontRoll', 'flap', rect(inL, rollTop, inR - inL, s.roll));
  // The inner front's free edge carries two locking tabs.
  const innerBottom = innerTop + s.innerHeight;
  const tabCentres = [x0 + w / 4, x0 + 3 * w / 4];
  const half = s.tab.width / 2, lead = Math.min(1, s.tab.height / 3);
  const innerOutline: PointMm[] = [{ x: inL, y: innerTop }, { x: inR, y: innerTop }, { x: inR, y: innerBottom }];
  for (const centre of [...tabCentres].reverse()) {
    innerOutline.push(
      { x: centre + half, y: innerBottom }, { x: centre + half - lead, y: innerBottom + s.tab.height },
      { x: centre - half + lead, y: innerBottom + s.tab.height }, { x: centre - half, y: innerBottom },
    );
  }
  innerOutline.push({ x: inL, y: innerBottom });
  add('frontInner', 'flap', innerOutline, rect(inL, innerTop, inR - inL, s.innerHeight));
  add('back', 'body', rect(x0, backTop, w, s.backHeight));
  add('left', 'body', rect(x0 - h, y0, h, d.depth));
  add('right', 'body', rect(x0 + w, y0, h, d.depth));
  // Corner tabs on the side walls' ends, tapered so they slide in.
  for (const [side, wallX, outward] of [['left', x0 - h, -1], ['right', x0 + w, 1]] as const) {
    // Cut a board clear of the front and back walls beside them.
    const root0 = side === 'left' ? wallX : wallX + t, root1 = side === 'left' ? wallX + h - t : wallX + h;
    const taper = Math.min((root1 - root0) / 3, s.ear * 0.4);
    // The edge beside the base is straight; the taper is on the outer edge.
    const [a, b] = outward < 0 ? [root0 + taper, root1] : [root0, root1 - taper];
    add(`${side}FrontTab`, 'flap', [
      { x: root0, y: frontTop }, { x: root1, y: frontTop }, { x: b, y: frontTop + s.ear }, { x: a, y: frontTop + s.ear },
    ]);
    add(`${side}BackTab`, 'flap', [
      { x: a, y: y0 - s.ear }, { x: b, y: y0 - s.ear }, { x: root1, y: y0 }, { x: root0, y: y0 },
    ]);
  }
  // Lid, hinged on the back wall's top edge.
  add('top', 'body', rect(x0, lidTop, w, s.lidDepth), undefined, 180);
  const tuckChamfer = Math.min(10, s.lidTuck / 2);
  add('lidFront', 'flap', [
    { x: x0 + s.clearance, y: lidTop }, { x: x0 + w - s.clearance, y: lidTop },
    { x: x0 + w - s.clearance - tuckChamfer, y: 0 }, { x: x0 + s.clearance + tuckChamfer, y: 0 },
  ], undefined, 180);
  const flapChamfer = Math.min(s.lidFlap, s.lidDepth / 4);
  for (const [id, edge, outward] of [['lidLeft', x0, -1], ['lidRight', x0 + w, 1]] as const) {
    const tip = edge + outward * s.lidFlap;
    add(id, 'flap', [
      { x: edge, y: lidTop }, { x: edge, y: backTop },
      { x: tip, y: backTop - flapChamfer }, { x: tip, y: lidTop + flapChamfer },
    ]);
  }
  // Slots in the base for the inner front's tabs, one board and a little
  // inside the front crease, beyond the corner tab's board.
  const cuts: LineMm[] = [];
  const slotY = frontTop - 2.5 * t, slotHalf = (t + 1) / 2;
  const box = (x1: number, y1: number, x2: number, y2: number) => [
    { start: { x: x1, y: y1 }, end: { x: x2, y: y1 } }, { start: { x: x2, y: y1 }, end: { x: x2, y: y2 } },
    { start: { x: x2, y: y2 }, end: { x: x1, y: y2 } }, { start: { x: x1, y: y2 }, end: { x: x1, y: y1 } },
  ];
  for (const centre of tabCentres) cuts.push(...box(centre - half - 1, slotY - slotHalf, centre + half + 1, slotY + slotHalf));
  // Finger hole across the roll strip, centred on the front.
  const hole = arcPoints(x0 + w / 2, rollTop + s.roll / 2, s.fingerHole, 0, 2 * Math.PI, 24);
  for (let i = 0; i < hole.length - 1; i++) cuts.push({ start: hole[i], end: hole[i + 1] });
  return finishExportGeometry(panels, 'cutting-template', [
    'One-piece corrugated pizza box: double front wall locked into the base, corner tabs trapped in the fold, lid with tuck and side flaps, finger hole.',
    `Width, depth and wall height are inside sizes on ${t} mm board. Ask your box maker to confirm the allowances for the flute you choose.`,
    'Artwork prints exactly as laid out on the design grid, including the flaps.',
  ], { cuts });
}

/** The printable cutting template, with the size checks. */
export function pizzaBoxExportGeometry(input: CartonDimensions) {
  const d = sanitizePizzaBoxDimensions(input);
  if (d.height < Math.max(20, 6 * d.thickness)) throw new Error(`The wall height is too small for this board. Use a wall height of at least ${Math.max(20, 6 * d.thickness)} mm.`);
  if (d.width < 100 || d.depth < 100) throw new Error('The box is too small for a pizza box\'s locking tabs and finger hole. Use a width and depth of at least 100 mm.');
  return pizzaBoxSheet(d);
}
