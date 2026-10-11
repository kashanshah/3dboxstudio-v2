import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { baseBoxDefinition } from '@/lib/packaging/parametric/definitions/base-box';

// The base box is a straight tuck end carton (ECMA A15.20). Its die, sizes and
// checks are the parametric definition in parametric/definitions/base-box.ts;
// this module is its flat side, without the 3D code, for layout migrations.

const baseBox = compileParametricSheet(baseBoxDefinition);

/** The cutting template; it is also the design grid. */
export function baseBoxSheet(input: CartonDimensions, openingMode: LegacyOpeningMode = 'closed') {
  return baseBox.sheet(input, { openingMode });
}

/** The printable cutting template, with the size checks. */
export function baseBoxExportGeometry(input: CartonDimensions, openingMode: LegacyOpeningMode = 'closed') {
  return baseBox.exportGeometry(input, { openingMode });
}
