import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { hexagonBoxDefinition } from '@/lib/packaging/parametric/definitions/hexagon-box';

// The hexagon box. Its die, sizes and checks are the parametric definition in
// parametric/definitions/hexagon-box.ts; this module is its flat side, without
// the 3D code.

const hexagonBox = compileParametricSheet(hexagonBoxDefinition);

/** The cutting template; it is also the design grid. */
export function hexagonBoxSheet(input: CartonDimensions) {
  return hexagonBox.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function hexagonBoxExportGeometry(input: CartonDimensions) {
  return hexagonBox.exportGeometry(input);
}
