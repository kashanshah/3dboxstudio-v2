import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { telescopeBoxDefinition } from '@/lib/packaging/parametric/definitions/tray-box';

// The telescope box. Its die, sizes and checks are the parametric definition in
// parametric/definitions/tray-box.ts; this module is its flat side, without
// the 3D code.

const telescopeBox = compileParametricSheet(telescopeBoxDefinition);

/** The cutting template; it is also the design grid. */
export function telescopeBoxSheet(input: CartonDimensions) {
  return telescopeBox.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function telescopeBoxExportGeometry(input: CartonDimensions) {
  return telescopeBox.exportGeometry(input);
}
