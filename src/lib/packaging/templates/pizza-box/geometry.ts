import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { pizzaBoxDefinition } from '@/lib/packaging/parametric/definitions/pizza-box';

// A one-piece corrugated pizza box with a locking double front. Its die,
// sizes and checks are the parametric definition in
// parametric/definitions/pizza-box.ts; this module is its flat side, without
// the 3D code, for layout migrations and the public template pages.

const pizzaBox = compileParametricSheet(pizzaBoxDefinition);

export const sanitizePizzaBoxDimensions = pizzaBox.sanitize;

/** The cutting template's panels, outlines, creases and cuts; also the design grid. */
export function pizzaBoxSheet(input: CartonDimensions) {
  return pizzaBox.sheet(input);
}

/** The printable cutting template, with the size checks. */
export function pizzaBoxExportGeometry(input: CartonDimensions) {
  return pizzaBox.exportGeometry(input);
}
