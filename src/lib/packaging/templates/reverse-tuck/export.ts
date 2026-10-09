import { sanitizeCartonDimensions, type CartonDimensions } from '../../reverse-tuck';
import { checkTuckEndSize, tuckEndFlapSources, tuckEndLidSizes, tuckEndSheet, type TuckEndLids } from '../tuck-end';

// The reverse tuck end carton (ECMA A20.20): the top lid hinges on the front
// and the bottom lid on the back, so each tucks into the opposite wall. See
// tuck-end.ts for how its die line is drawn.

// Hinged on the back, the bottom sits upside down on the sheet: artwork placed
// on it alone is turned half a turn to read upright on the box.
const LIDS: TuckEndLids = { top: 'front', bottom: 'back', bottomRotation: 180 };

/**
 * Panels with no artwork of their own carry on the edge of the panel they fold
 * from: tuck and dust flaps, and the top and bottom from the front and back.
 * The glue flap stays bare for gluing.
 */
export const REVERSE_TUCK_FLAP_SOURCES: Record<string, string> = tuckEndFlapSources(LIDS);

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
