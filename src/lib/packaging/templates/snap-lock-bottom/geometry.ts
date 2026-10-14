import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { snapLockBottomDefinition } from '@/lib/packaging/parametric/definitions/snap-lock-bottom';

// The tuck top snap-lock (1-2-3) bottom carton. Its die, sizes and checks are the
// parametric definition in parametric/definitions/snap-lock-bottom.ts; this
// module is its flat side, without the 3D code.

const snapLockBottom = compileParametricSheet(snapLockBottomDefinition);

/** The cutting template; it is also the design grid. */
export function snapLockBottomSheet(input: CartonDimensions) {
  return snapLockBottom.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function snapLockBottomExportGeometry(input: CartonDimensions) {
  return snapLockBottom.exportGeometry(input);
}
