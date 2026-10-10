import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { sleeveBoxDefinition } from '@/lib/packaging/parametric/definitions/sleeve-box';

// An open-ended folding-carton sleeve. Its die, sizes and checks are the
// parametric definition in parametric/definitions/sleeve-box.ts; this module
// is its flat side, without the 3D code.

const sleeveBox = compileParametricSheet(sleeveBoxDefinition);

/** The cutting template; it is also the design grid. */
export function sleeveBoxSheet(input: CartonDimensions) {
  return sleeveBox.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function sleeveBoxExportGeometry(input: CartonDimensions) {
  return sleeveBox.exportGeometry(input);
}
