import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { pillowBoxDefinition } from '@/lib/packaging/parametric/definitions/pillow-box';

// The pillow box. Its die, sizes and checks are the parametric definition in
// parametric/definitions/pillow-box.ts; this module is its flat side, without
// the 3D code.

const pillowBox = compileParametricSheet(pillowBoxDefinition);

/** The cutting template; it is also the design grid. */
export function pillowBoxSheet(input: CartonDimensions) {
  return pillowBox.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function pillowBoxExportGeometry(input: CartonDimensions) {
  return pillowBox.exportGeometry(input);
}
