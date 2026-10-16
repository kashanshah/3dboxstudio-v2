import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { drawerBoxDefinition } from '@/lib/packaging/parametric/definitions/drawer-box';

// The drawer box. Its die, sizes and checks are the parametric definition in
// parametric/definitions/drawer-box.ts; this module is its flat side, without
// the 3D code.

const drawerBox = compileParametricSheet(drawerBoxDefinition);

/** The cutting template; it is also the design grid. */
export function drawerBoxSheet(input: CartonDimensions) {
  return drawerBox.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function drawerBoxExportGeometry(input: CartonDimensions) {
  return drawerBox.exportGeometry(input);
}
