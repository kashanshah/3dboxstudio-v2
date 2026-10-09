import { sanitizeCartonDimensions } from '../../reverse-tuck';
import type { TemplateMeshBuilder } from '../../template-mesh';
import { foldSheet, restingSetback, type Mat4, type SheetHinge } from '../../fold-sheet';
import { boardThickness, rectangleSheetPanels, substage } from '../folded-box';
import { getPizzaBoxPanels } from './geometry';

// Folded from the dieline itself, the way a pizza tray is made: side walls up,
// their corner ears in, the front and back walls up over the ears, then the
// lid's skirts fold down and the lid closes over the tray.

const PARENT: Record<string, string> = {
  left: 'bottom', right: 'bottom', front: 'bottom', back: 'bottom',
  leftBackTab: 'left', leftFrontTab: 'left', rightBackTab: 'right', rightFrontTab: 'right',
  top: 'back', lidFront: 'top', lidLeft: 'top', lidRight: 'top',
};

export const buildPizzaBoxTemplateMeshes: TemplateMeshBuilder = ({ dimensions, formation, opening, color, interiorColor }) => {
  const d = sanitizeCartonDimensions(dimensions);
  const t = boardThickness(d);
  const flat = getPizzaBoxPanels(d);
  const base = flat.find(panel => panel.id === 'bottom')!;
  const formed = Math.min(1, Math.max(0, formation / 100));
  const quarter = Math.PI / 2;
  const sides = substage(formed, 0, 0.35) * quarter;
  const ears = substage(formed, 0.2, 0.55) * quarter;
  const walls = substage(formed, 0.45, 0.9) * quarter;
  const skirts = substage(formed, 0.6, 1) * quarter;
  const lid = Math.min(1, Math.max(0, 1 - opening / 100)) * walls;
  const angle: Record<string, number> = {
    left: sides, right: sides, front: walls, back: walls,
    leftBackTab: ears, leftFrontTab: ears, rightBackTab: ears, rightFrontTab: ears,
    top: lid, lidLeft: skirts, lidRight: skirts,
    lidFront: skirtCurl(skirts, lid, d.depth, d.height * 0.65, t * 1.3),
  };
  // The front and back walls close outside the side walls' ends. The ears
  // tuck just inside them, the lid rests on the back wall's top edge, its side
  // skirts tuck one board inside the side walls and its front skirt inside the
  // front wall and its ears.
  const resting = restingSetback(t);
  const setback: Record<string, number> = {
    front: resting, back: resting,
    leftBackTab: t * 0.5, leftFrontTab: t * 0.5, rightBackTab: t * 0.5, rightFrontTab: t * 0.5,
    lidLeft: t * 1.1, lidRight: t * 1.1, lidFront: t * 1.6,
    top: resting,
  };
  const panels = rectangleSheetPanels(flat).map(panel => ({
    ...panel,
    // The front and back walls run the full width, over the side walls' ends.
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
