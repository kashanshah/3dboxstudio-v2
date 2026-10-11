// FROZEN REFERENCE. The pizza box exactly as it was hand-written before it
// moved to the parametric definition in
// src/lib/packaging/parametric/definitions/pizza-box.ts. Nothing in the app
// imports this file: scripts/parametric-templates.test.cjs compares the
// definition against it, so any change to the die or fold shows up as a test
// failure. Never edit it to make that test pass.

import type { TemplateMeshBuilder } from '@/lib/packaging/template-mesh';
import { foldSheet, restingSetback, type Mat4, type SheetHinge, type SheetPanel } from '@/lib/packaging/fold-sheet';
import { boardThickness, panelName, substage } from '@/lib/packaging/templates/folded-box';
import { pizzaBoxSheet, pizzaBoxSizes, sanitizePizzaBoxDimensions } from './geometry';

// Folded from the cutting template itself, the way a pizza box is made: the
// side walls up, their corner tabs in, the front and back walls up outside
// the tabs, then the front's inner layer folds down over the tabs and locks
// into the base; the lid's flaps fold down and the lid closes over the tray.

const PARENT: Record<string, string> = {
  left: 'bottom', right: 'bottom', front: 'bottom', back: 'bottom',
  leftBackTab: 'left', leftFrontTab: 'left', rightBackTab: 'right', rightFrontTab: 'right',
  frontRoll: 'front', frontInner: 'frontRoll',
  top: 'back', lidFront: 'top', lidLeft: 'top', lidRight: 'top',
};

export const buildPizzaBoxTemplateMeshes: TemplateMeshBuilder = ({ dimensions, formation, opening, color, interiorColor }) => {
  const d = sanitizePizzaBoxDimensions(dimensions);
  const t = boardThickness(d);
  const sheet = pizzaBoxSheet(d);
  const sizes = pizzaBoxSizes(d);
  const base = sheet.panels.find(panel => panel.id === 'bottom')!;
  const roll = sheet.panels.find(panel => panel.id === 'frontRoll')!;
  const formed = Math.min(1, Math.max(0, formation / 100));
  const quarter = Math.PI / 2;
  const sides = substage(formed, 0, 0.3) * quarter;
  const tabs = substage(formed, 0.2, 0.45) * quarter;
  const walls = substage(formed, 0.4, 0.6) * quarter;
  // The front folds double: over the roll strip, then down inside.
  const rollOver = substage(formed, 0.6, 0.72) * quarter;
  const inner = substage(formed, 0.7, 0.85) * quarter;
  const skirts = substage(formed, 0.7, 1) * quarter;
  const lid = Math.min(1, Math.max(0, 1 - opening / 100)) * substage(formed, 0.6, 1) * quarter;
  const angle: Record<string, number> = {
    left: sides, right: sides, front: walls, back: walls,
    leftBackTab: tabs, leftFrontTab: tabs, rightBackTab: tabs, rightFrontTab: tabs,
    frontRoll: rollOver, frontInner: inner,
    top: lid, lidLeft: skirts, lidRight: skirts,
    lidFront: skirtCurl(skirts, lid, sizes.lidDepth, sizes.lidTuck, t * 3.5),
  };
  // The front and back walls close outside the side walls' ends and their
  // corner tabs; the lid rests on the walls, its flaps one board inside them
  // and its front tuck inside the double front.
  const resting = restingSetback(t);
  const setback: Record<string, number> = {
    front: resting, back: resting,
    // Corner tabs lie flat against the inside of the front and back walls.
    leftBackTab: t * 0.5, leftFrontTab: t * 0.5, rightBackTab: t * 0.5, rightFrontTab: t * 0.5,
    lidLeft: t * 1.1, lidRight: t * 1.1, lidFront: t * 3.5,
    top: resting,
  };
  // A score bends through three boards, wider than the two-board roll
  // strip: in 3D the strip is drawn three boards wide and the inner front one
  // board shorter, so the two layers sit apart by a corner tab's board.
  const rollWidth = 3 * t;
  const innerEnd = roll.y + roll.height + sizes.innerHeight;
  const shape = (panel: (typeof sheet.panels)[number]) => panel.id === 'frontRoll'
    ? [{ x: roll.x, y: roll.y }, { x: roll.x + roll.width, y: roll.y }, { x: roll.x + roll.width, y: roll.y + rollWidth }, { x: roll.x, y: roll.y + rollWidth }]
    : panel.id === 'frontInner'
      ? [{ x: roll.x, y: roll.y + rollWidth }, { x: roll.x + roll.width, y: roll.y + rollWidth }, { x: roll.x + roll.width, y: innerEnd }, { x: roll.x, y: innerEnd }]
      : panel.fold ?? panel.outline;
  const panels: SheetPanel[] = sheet.panels.map(panel => ({
    id: panel.id,
    name: panelName(panel.label),
    outline: shape(panel),
    artworkRotation: panel.artworkRotation,
    closureFlap: panel.kind === 'flap' && panel.id !== 'frontInner' && panel.id !== 'frontRoll',
    layer: panel.id === 'front' || panel.id === 'back' ? 1.5 : panel.id === 'top' ? 2 : panel.id.endsWith('Tab') || panel.id.startsWith('lid') ? 0 : 1,
  }));
  const hinges: SheetHinge[] = Object.entries(PARENT).map(([child, parent]) => ({ child, parent, angle: angle[child], setback: setback[child] }));
  // The sheet lies printed side down with the lid at the back. Turning it over
  // that way puts the dieline's left wall on the viewer's right.
  const cx = base.x + base.width / 2, cy = base.y + base.height / 2;
  const placement: Mat4 = [-1, 0, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, cx, -d.height / 2, -cy, 1];
  return foldSheet({ panels, hinges, root: 'bottom', thickness: t, color, interiorColor, placement });
};

/**
 * How far the lid's front skirt is curled while the lid (depth `depth`) swings
 * from upright (0) to closed (π/2). Its tip sweeps out further than the lid's
 * edge on the way down, so it curls past square just enough to pass inside
 * the front wall, `clearance` behind the lid's edge, then springs back.
 */
function skirtCurl(fold: number, lid: number, depth: number, skirt: number, clearance: number) {
  if (fold <= 0 || skirt <= 0) return fold;
  const edge = [depth * Math.sin(lid), depth * Math.cos(lid)];
  const along = [Math.sin(lid), Math.cos(lid)], inward = [Math.cos(lid), -Math.sin(lid)];
  const clear = (curl: number) => {
    const tip = [0, 1].map(i => edge[i] + skirt * (along[i] * Math.cos(curl) + inward[i] * Math.sin(curl)));
    return tip[1] >= 0 || tip[0] <= depth - clearance;
  };
  let curl = fold;
  while (curl < Math.PI * 0.85 && !clear(curl)) curl += Math.PI / 360;
  return curl;
}
