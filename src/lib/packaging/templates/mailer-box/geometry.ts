import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { mailerBoxDefinition } from '@/lib/packaging/parametric/definitions/mailer-box';

// A corrugated mailer. Its die, sizes and checks are the
// parametric definition in parametric/definitions/mailer-box.ts; this module
// is its flat side, without the 3D code.

const mailerBox = compileParametricSheet(mailerBoxDefinition);

/** The cutting template; it is also the design grid. */
export function mailerBoxSheet(input: CartonDimensions) {
  return mailerBox.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function mailerBoxExportGeometry(input: CartonDimensions) {
  return mailerBox.exportGeometry(input);
}
