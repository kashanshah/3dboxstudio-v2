import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { cakeBoxDefinition } from '@/lib/packaging/parametric/definitions/cake-box';

// The cake box. Its die, sizes and checks are the parametric definition in
// parametric/definitions/cake-box.ts; this module is its flat side, without
// the 3D code.

const cakeBox = compileParametricSheet(cakeBoxDefinition);

/** The cutting template; it is also the design grid. */
export function cakeBoxSheet(input: CartonDimensions) {
  return cakeBox.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function cakeBoxExportGeometry(input: CartonDimensions) {
  return cakeBox.exportGeometry(input);
}
