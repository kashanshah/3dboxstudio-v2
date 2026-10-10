import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { splitTopDefinition } from '@/lib/packaging/parametric/definitions/split-top';

// The split top is a regular slotted container (FEFCO 0201), the everyday
// corrugated shipping box, or with every top flap meeting in the middle a
// centre special slotted container (FEFCO 0204). Its die, sizes and checks
// are the parametric definition in parametric/definitions/split-top.ts; this
// module is its flat side, without the 3D code, for layout migrations and the
// public template pages.

export type SplitTopSide = 'side_a' | 'side_b';

const splitTop = compileParametricSheet(splitTopDefinition);

export const sanitizeSplitTopDimensions = splitTop.sanitize;

/** The definition's sizes for a box: slot, joint, scored panel widths and so on. */
export function splitTopSizes(d: CartonDimensions, side: SplitTopSide = 'side_a') {
  return splitTop.values(d, { splitTopHingeSide: side });
}

/** The cutting template's panels, outlines, scores and cuts. */
export function splitTopSheet(input: CartonDimensions, side: SplitTopSide = 'side_a') {
  return splitTop.sheet(input, { splitTopHingeSide: side });
}

/** The printable cutting template, with the size checks. */
export function splitTopExportGeometry(input: CartonDimensions, side: SplitTopSide = 'side_a') {
  return splitTop.exportGeometry(input, { splitTopHingeSide: side });
}
