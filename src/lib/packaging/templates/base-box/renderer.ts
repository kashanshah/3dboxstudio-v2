import { sanitizeCartonDimensions } from '@/lib/packaging/reverse-tuck';
import { baseBoxPanels } from '@/lib/packaging/box-structures';
import type { TemplateMeshBuilder } from '@/lib/packaging/template-mesh';
import { foldSheet, restingSetback, translation, type SheetHinge } from '@/lib/packaging/fold-sheet';
import { boardThickness, rectangleSheetPanels, substage } from '@/lib/packaging/templates/folded-box';

// Folded from the dieline itself: the body strip wraps round, the glue flap
// tucks inside the back, and the bottom and lid close over the walls' edges.

export const buildBaseBoxTemplateMeshes: TemplateMeshBuilder = ({ dimensions, formation, opening, color, interiorColor, openingMode }) => {
  const d = sanitizeCartonDimensions(dimensions);
  const t = boardThickness(d);
  const flat = baseBoxPanels(d, openingMode);
  const front = flat.find(panel => panel.id === 'front')!;
  const formed = Math.min(1, Math.max(0, formation / 100));
  const open = Math.min(1, Math.max(0, opening / 100));
  const quarter = Math.PI / 2;

  const walls = substage(formed, 0, 0.6) * quarter;
  const back = substage(formed, 0.15, 0.75) * quarter;
  const bottom = substage(formed, 0.6, 1) * quarter;
  // A lid on its own hinge stays open while the carton forms and closes in
  // the opening stage; a plain top closes as the carton forms.
  const hingedLid = openingMode === 'lid_from_back' || openingMode === 'lid_from_front' || openingMode === 'lid_from_left' || openingMode === 'lid_from_right';
  const top = (hingedLid ? 1 - open : substage(formed, 0.7, 1)) * quarter;
  // Doors form with the carton, then swing open about the front's creases.
  const door = substage(formed, 0.8, 1) * open * quarter;
  const leftDoor = openingMode === 'door_left' || openingMode === 'double_doors';
  const rightDoor = openingMode === 'door_right' || openingMode === 'double_doors';

  const lidParent = openingMode === 'lid_from_back' ? 'back' : openingMode === 'lid_from_left' ? 'left' : openingMode === 'lid_from_right' ? 'right' : 'front';
  const resting = restingSetback(t);
  const hinges: SheetHinge[] = [
    { child: 'left', parent: 'front', angle: walls - (leftDoor ? door : 0) },
    { child: 'right', parent: 'front', angle: walls - (rightDoor ? door : 0) },
    { child: 'back', parent: 'right', angle: back },
    // The glue flap is stuck to the inside of the back. On a left door it
    // keeps facing the same way as the door starts to open, so its edge never
    // sweeps through the back, and lies back against the door once it is open.
    { child: 'glue', parent: 'left', angle: back + (leftDoor ? door * (1 - 0.3 * (door / quarter) ** 2) : 0), setback: t * 1.1 },
    { child: 'bottom', parent: 'front', angle: bottom, setback: resting },
    { child: 'top', parent: lidParent, angle: top, setback: resting },
  ];
  const panels = rectangleSheetPanels(flat).map(panel => ({
    ...panel,
    layer: panel.id === 'top' || panel.id === 'bottom' ? 2 : panel.id === 'glue' ? 0 : 1,
  }));
  const placement = translation([-(front.x + front.width / 2), front.y + front.height / 2, d.depth / 2]);
  return foldSheet({ panels, hinges, root: 'front', thickness: t, color, interiorColor, placement });
};
