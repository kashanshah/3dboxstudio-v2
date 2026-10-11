import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { reverseTuckDefinition } from '@/lib/packaging/parametric/definitions/reverse-tuck';

// The reverse tuck end carton (ECMA A20.20). Its die, sizes and checks are the
// parametric definition in parametric/definitions/reverse-tuck.ts; this module
// is its flat side, without the 3D code, for layout migrations and the public
// template pages.

const reverseTuck = compileParametricSheet(reverseTuckDefinition);

/** The printable cutting template; it is also the design grid. */
export function reverseTuckExportGeometry(input: CartonDimensions) {
  return reverseTuck.exportGeometry(input);
}

/** The cutting template's panels and outlines, without the printability checks. */
export function reverseTuckSheet(input: CartonDimensions) {
  return reverseTuck.sheet(input);
}
