import { sanitizeCartonDimensions, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import { checkTuckEndSize, tuckEndSheet, type TuckEndLids, type TuckWall } from '../tuck-end';

// The base box is a straight tuck end carton (ECMA A15.20): both lids hinge on
// the front, so the top and bottom tuck into the back. A design may hinge its
// lid on another wall instead; the bottom always hinges on the front. See
// tuck-end.ts for how the die line is drawn.

/** The wall the top lid hinges on for each opening. */
export function baseBoxLids(openingMode: LegacyOpeningMode = 'closed'): TuckEndLids {
  const top: TuckWall = openingMode === 'lid_from_back' ? 'back'
    : openingMode === 'lid_from_left' ? 'left'
      : openingMode === 'lid_from_right' ? 'right'
        : 'front';
  return { top, bottom: 'front' };
}

/** The cutting template; it is also the design grid. */
export function baseBoxSheet(input: CartonDimensions, openingMode: LegacyOpeningMode = 'closed') {
  const t = sanitizeCartonDimensions(input).thickness;
  const lids = baseBoxLids(openingMode);
  return tuckEndSheet(input, lids, [
    lids.top === 'front'
      ? 'Straight tuck end (ECMA A15.20): slit-locked tucks, shouldered dust flaps, 15° glue flap and a thumb notch.'
      : `Tuck end carton with the lid hinged on the ${lids.top}: slit-locked tucks, shouldered dust flaps, 15° glue flap and a thumb notch.`,
    `Width, depth and height are inside sizes; panels are creased one board (${t} mm) wider. Ask your printer to confirm the allowances for the board you choose.`,
    'Artwork prints exactly as laid out on the design grid, including the closure flaps.',
  ]);
}

/** The printable cutting template, with the size checks. */
export function baseBoxExportGeometry(input: CartonDimensions, openingMode: LegacyOpeningMode = 'closed') {
  return baseBoxSheet(checkTuckEndSize(input), openingMode);
}
