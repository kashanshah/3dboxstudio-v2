import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { rigidLidBaseDefinition } from '@/lib/packaging/parametric/definitions/rigid-lid-base';

// A two-piece rigid lid and base box. Its die, sizes and checks are the
// parametric definition in parametric/definitions/rigid-lid-base.ts; this module
// is its flat side, without the 3D code.

const rigidLidBase = compileParametricSheet(rigidLidBaseDefinition);

/** The cutting template; it is also the design grid. */
export function rigidLidBaseSheet(input: CartonDimensions) {
  return rigidLidBase.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function rigidLidBaseExportGeometry(input: CartonDimensions) {
  return rigidLidBase.exportGeometry(input);
}
