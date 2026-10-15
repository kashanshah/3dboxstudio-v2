import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { gableBoxDefinition } from '@/lib/packaging/parametric/definitions/gable-box';

// The gable box. Its die, sizes and checks are the parametric definition in
// parametric/definitions/gable-box.ts; this module is its flat side, without
// the 3D code.

const gableBox = compileParametricSheet(gableBoxDefinition);

/** The cutting template; it is also the design grid. */
export function gableBoxSheet(input: CartonDimensions) {
  return gableBox.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function gableBoxExportGeometry(input: CartonDimensions) {
  return gableBox.exportGeometry(input);
}
