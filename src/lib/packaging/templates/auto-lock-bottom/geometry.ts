import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { autoLockBottomDefinition } from '@/lib/packaging/parametric/definitions/auto-lock-bottom';

// The tuck top auto-lock bottom carton. Its die, sizes and checks are the
// parametric definition in parametric/definitions/auto-lock-bottom.ts; this
// module is its flat side, without the 3D code.

const autoLockBottom = compileParametricSheet(autoLockBottomDefinition);

/** The cutting template; it is also the design grid. */
export function autoLockBottomSheet(input: CartonDimensions) {
  return autoLockBottom.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function autoLockBottomExportGeometry(input: CartonDimensions) {
  return autoLockBottom.exportGeometry(input);
}
