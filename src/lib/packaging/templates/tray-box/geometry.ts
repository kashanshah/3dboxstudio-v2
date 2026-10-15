import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { trayBoxDefinition } from '@/lib/packaging/parametric/definitions/tray-box';

// The tray box. Its die, sizes and checks are the parametric definition in
// parametric/definitions/tray-box.ts; this module is its flat side, without
// the 3D code.

const trayBox = compileParametricSheet(trayBoxDefinition);

/** The cutting template; it is also the design grid. */
export function trayBoxSheet(input: CartonDimensions) {
  return trayBox.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function trayBoxExportGeometry(input: CartonDimensions) {
  return trayBox.exportGeometry(input);
}
