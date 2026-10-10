// FROZEN REFERENCE. The tuck end cartons exactly as they were hand-written
// before they moved to the parametric definitions in
// src/lib/packaging/parametric/definitions. Nothing in the app imports this
// file: scripts/parametric-templates.test.cjs compares the definitions
// against it, so any change to a die or fold shows up as a test failure.
// Never edit it to make that test pass.

import { sanitizeCartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { TemplateMeshBuilder } from '@/lib/packaging/template-mesh';
import { foldSheet, translation, type SheetHinge, type SheetPanel } from '@/lib/packaging/fold-sheet';
import { boardThickness, panelName, substage } from '@/lib/packaging/templates/folded-box';
import { tuckEndLidSizes, tongueAngle } from './tuck-end';
import { baseBoxLids, baseBoxSheet } from './base-box-geometry';

// Folded from the cutting template itself: the body strip wraps round with the
// glue flap stuck inside the back, then each end closes like a real carton:
// dust flaps in, the tuck pre-folded, the lid down and the tuck in behind the
// opposite wall. A hinged lid closes in the opening stage; doors swing open
// about the front's creases.

export const buildBaseBoxTemplateMeshes: TemplateMeshBuilder = ({ dimensions, formation, opening, color, interiorColor, openingMode }) => {
  const d = sanitizeCartonDimensions(dimensions);
  const t = boardThickness(d);
  const sheet = baseBoxSheet(d, openingMode);
  const lids = baseBoxLids(openingMode);
  const front = sheet.panels.find(panel => panel.id === 'front')!;
  const formed = Math.min(1, Math.max(0, formation / 100));
  const open = Math.min(1, Math.max(0, opening / 100));
  const quarter = Math.PI / 2;

  const walls = substage(formed, 0, 0.6) * quarter;
  const back = substage(formed, 0.15, 0.75) * quarter;
  const hingedLid = openingMode === 'lid_from_back' || openingMode === 'lid_from_front' || openingMode === 'lid_from_left' || openingMode === 'lid_from_right';
  // Each end closes in order, as by hand: dust flaps all the way in, then the
  // tuck pre-folded, then the lid down with the tuck sliding in.
  const bottomDust = substage(formed, 0.45, 0.58) * quarter;
  const bottomPrefold = substage(formed, 0.58, 0.66) * quarter;
  const bottom = substage(formed, 0.62, 0.82) * quarter;
  const topDust = substage(formed, 0.78, 0.88) * quarter;
  const topPrefold = substage(formed, 0.88, 0.94) * quarter;
  // A hinged lid closes only once the carton has formed.
  const top = (hingedLid ? (1 - open) * substage(formed, 0.9, 1) : substage(formed, 0.9, 1)) * quarter;
  // Doors form with the carton, then swing open about the front's creases.
  const door = substage(formed, 0.8, 1) * open * quarter;
  const leftDoor = openingMode === 'door_left' || openingMode === 'double_doors';
  const rightDoor = openingMode === 'door_right' || openingMode === 'double_doors';

  const topLid = tuckEndLidSizes(d, lids.top), bottomLid = tuckEndLidSizes(d, lids.bottom);
  // The tuck that slides into the back also passes the glue flap stuck there.
  const clearance = (wall: string) => (wall === 'front' ? t * 2.2 : t * 1.1);
  const reach = (wall: string) => (wall === 'front' || wall === 'back' ? d.depth : d.width);
  const hinges: SheetHinge[] = [
    { child: 'left', parent: 'front', angle: walls - (leftDoor ? door : 0) },
    { child: 'right', parent: 'front', angle: walls - (rightDoor ? door : 0) },
    { child: 'back', parent: 'right', angle: back },
    // The glue flap is stuck to the inside of the back. On a left door it
    // keeps facing the same way as the door starts to open, so its edge never
    // sweeps through the back, and lies back against the door once it is open.
    { child: 'glue', parent: 'left', angle: back + (leftDoor ? door * (1 - 0.3 * (door / quarter) ** 2) : 0), setback: t * 1.1 },
    { child: 'top', parent: lids.top, angle: top },
    { child: 'bottom', parent: lids.bottom, angle: bottom },
    { child: 'top-tuck', parent: 'top', angle: tongueAngle(topPrefold, top, reach(lids.top), topLid.tongue, clearance(lids.top)), setback: clearance(lids.top) },
    { child: 'bottom-tuck', parent: 'bottom', angle: tongueAngle(bottomPrefold, bottom, reach(lids.bottom), bottomLid.tongue, clearance(lids.bottom)), setback: clearance(lids.bottom) },
  ];
  for (const panel of sheet.panels) {
    const match = panel.id.match(/^(top|bottom)-(left|right|front|back)-dust$/);
    if (match) hinges.push({ child: panel.id, parent: match[2], angle: match[1] === 'top' ? topDust : bottomDust, setback: t * 1.1 });
  }
  const walled = new Set(['glue', 'left', 'front', 'right', 'back', 'top', 'bottom']);
  const panels: SheetPanel[] = sheet.panels.map(panel => ({
    id: panel.id,
    name: panelName(panel.label),
    // The 3D folds each panel's four-corner shape; the print file cuts the full outline.
    outline: panel.fold ?? panel.outline,
    artworkRotation: panel.artworkRotation,
    closureFlap: !walled.has(panel.id),
    layer: panel.id === 'top' || panel.id === 'bottom' ? 2 : walled.has(panel.id) && panel.id !== 'glue' ? 1 : 0,
  }));
  const placement = translation([-(front.x + front.width / 2), front.y + front.height / 2, d.depth / 2]);
  return foldSheet({ panels, hinges, root: 'front', thickness: t, color, interiorColor, placement });
};
