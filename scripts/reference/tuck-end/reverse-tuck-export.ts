// FROZEN REFERENCE. The tuck end cartons exactly as they were hand-written
// before they moved to the parametric definitions in
// src/lib/packaging/parametric/definitions. Nothing in the app imports this
// file: scripts/parametric-templates.test.cjs compares the definitions
// against it, so any change to a die or fold shows up as a test failure.
// Never edit it to make that test pass.

import { sanitizeCartonDimensions, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { checkTuckEndSize, tuckEndLidSizes, tuckEndSheet, type TuckEndLids } from './tuck-end';

// The reverse tuck end carton (ECMA A20.20): the top lid hinges on the front
// and the bottom lid on the back, so each tucks into the opposite wall. See
// tuck-end.ts for how its die line is drawn.

// Hinged on the back, the bottom sits upside down on the sheet: artwork placed
// on it alone is turned half a turn to read upright on the box.
const LIDS: TuckEndLids = { top: 'front', bottom: 'back', bottomRotation: 180 };

/** The top lid's sizes, which the 3D model's tuck uses. */
export function reverseTuckClosureSizes(d: CartonDimensions) {
  return tuckEndLidSizes(sanitizeCartonDimensions(d), LIDS.top);
}

/** The printable cutting template; it is also the design grid. */
export function reverseTuckExportGeometry(input: CartonDimensions) {
  return reverseTuckSheet(checkTuckEndSize(input));
}

/** The cutting template's panels and outlines, without the printability checks. */
export function reverseTuckSheet(input: CartonDimensions) {
  const t = sanitizeCartonDimensions(input).thickness;
  return tuckEndSheet(input, LIDS, [
    'Reverse tuck end (ECMA A20.20): slit-locked tucks, shouldered dust flaps, 15° glue flap and a thumb notch.',
    `Width, depth and height are inside sizes; panels are creased one board (${t} mm) wider. Ask your printer to confirm the allowances for the board you choose.`,
    'Artwork prints exactly as laid out on the design grid, including the closure flaps.',
  ]);
}
