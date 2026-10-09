import { reverseTuckFoldState, sanitizeCartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { TemplateMeshBuilder } from '@/lib/packaging/template-mesh';
import { foldSheet, translation, type SheetHinge, type SheetPanel } from '@/lib/packaging/fold-sheet';
import { reverseTuckClosureSizes, reverseTuckSheet } from './export';

// The 3D carton is folded from the cutting template itself, so every flap in
// the print file moves in 3D and each crease bends like scored card.

const NAMES: Record<string, string> = {
  glue: 'Glue', left: 'Left', front: 'Front', right: 'Right', back: 'Back', top: 'Top', bottom: 'Bottom',
  'top-tuck': 'Top Tuck', 'bottom-tuck': 'Bottom Tuck',
  'top-left-dust': 'Top Left Dust Flap', 'top-right-dust': 'Top Right Dust Flap',
  'bottom-left-dust': 'Bottom Left Dust Flap', 'bottom-right-dust': 'Bottom Right Dust Flap',
};

const PARENT: Record<string, string> = {
  left: 'front', right: 'front', glue: 'left', back: 'right', top: 'front', bottom: 'back',
  'top-tuck': 'top', 'bottom-tuck': 'bottom',
  'top-left-dust': 'left', 'top-right-dust': 'right', 'bottom-left-dust': 'left', 'bottom-right-dust': 'right',
};

export const buildReverseTuckTemplateMeshes: TemplateMeshBuilder = ({ dimensions, formation, color, interiorColor }) => {
  const d = sanitizeCartonDimensions(dimensions);
  const t = Math.max(0.05, Math.min(d.thickness, Math.min(d.width, d.depth) * 0.08));
  const sheet = reverseTuckSheet(d);
  const front = sheet.panels.find(panel => panel.id === 'front')!;
  const sizes = reverseTuckClosureSizes(d);
  const fold = reverseTuckFoldState(formation);
  const quarter = Math.PI / 2;
  // Each closure folds like a real carton: dust flaps in, the tuck tongue
  // pre-folded, then the lid swings down and the tongue slides in behind the
  // opposite panel.
  const top = substage(fold.top, 0.25, 1) * quarter;
  const bottom = substage(fold.bottom, 0.25, 1) * quarter;
  const angle: Record<string, number> = {
    left: fold.walls * quarter,
    right: fold.walls * quarter,
    back: fold.back * quarter,
    glue: fold.back * quarter,
    top,
    bottom,
    // The tip clears the opposite wall's board, and at the top the glue flap
    // stuck inside the back.
    'top-tuck': tongueAngle(substage(fold.top, 0.1, 0.5) * quarter, top, d.depth, sizes.tongue, t * 2),
    'bottom-tuck': tongueAngle(substage(fold.bottom, 0.1, 0.5) * quarter, bottom, d.depth, sizes.tongue, t * 2),
    'top-left-dust': substage(fold.top, 0, 0.4) * quarter,
    'top-right-dust': substage(fold.top, 0, 0.4) * quarter,
    'bottom-left-dust': substage(fold.bottom, 0, 0.4) * quarter,
    'bottom-right-dust': substage(fold.bottom, 0, 0.4) * quarter,
  };
  // Flaps that end up behind another panel (the glue flap inside the back,
  // the tongues inside the opposite wall, the dust flaps under the lids)
  // crease a little lower, so they rest against that panel's inside.
  const tuck = t * 1.1;
  const setback: Record<string, number> = {
    glue: tuck,
    // The top tongue also passes the glue flap stuck inside the back.
    'top-tuck': t * 2.2,
    'bottom-tuck': tuck,
    'top-left-dust': tuck,
    'top-right-dust': tuck,
    'bottom-left-dust': tuck,
    'bottom-right-dust': tuck,
  };
  const panels: SheetPanel[] = sheet.panels.map(panel => ({
    id: panel.id,
    name: NAMES[panel.id] ?? panel.label,
    outline: panel.outline,
    closureFlap: !['glue', 'left', 'front', 'right', 'back', 'top', 'bottom'].includes(panel.id),
    layer: panel.id === 'top' || panel.id === 'bottom' ? 2 : PARENT[panel.id] && !['left', 'right', 'back'].includes(panel.id) ? 0 : 1,
  }));
  const hinges: SheetHinge[] = Object.entries(PARENT).map(([child, parent]) => ({ child, parent, angle: angle[child] ?? 0, setback: setback[child] }));
  // Flat sheet → scene: the front panel centred on the origin, facing the viewer.
  const placement = translation([-(front.x + front.width / 2), front.y + front.height / 2, d.depth / 2]);
  return foldSheet({ panels, hinges, root: 'front', thickness: t, color, interiorColor, placement });
};

/**
 * How far the tuck tongue is curled, given how far it has been pre-folded and
 * how far the lid (depth `depth`) has swung from upright (0) to closed (π/2),
 * keeping the tip `clearance` inside the opposite wall.
 * While the lid comes down, the tongue is curled past square just enough for
 * its tip to clear the opposite panel, then springs back to square inside it.
 */
function tongueAngle(prefold: number, lid: number, depth: number, tongue: number, clearance: number) {
  if (tongue <= 0) return prefold;
  // Tip distance beyond the lid's free edge, toward the opposite panel, is
  // tongue·sin(lid + curl); it must stay within the room left, depth·(1 − sin lid).
  const room = Math.max(-1, Math.min(1, (depth * (1 - Math.sin(lid)) - clearance) / tongue));
  const needed = Math.PI - lid - Math.asin(room);
  return Math.min(Math.PI * 0.85, Math.max(prefold, prefold > 0 ? needed : 0));
}

function substage(value: number, start: number, end: number) {
  const x = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return x * x * (3 - 2 * x);
}
