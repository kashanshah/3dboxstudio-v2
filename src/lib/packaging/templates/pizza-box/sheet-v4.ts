import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { pizzaBoxDefinition } from '@/lib/packaging/parametric/definitions/pizza-box';

// The pizza box's design grid as it stood for layout version 4: the current
// die with the base cut to the inside size (W = width, D = depth), before it
// grew to allow for the walls' board. Saved designs move from it onto the
// current grid.

const pizzaBoxV4 = compileParametricSheet({
  ...pizzaBoxDefinition,
  derived: pizzaBoxDefinition.derived.map(([key, value]) => [key, key === 'W' ? 'width' : key === 'D' ? 'depth' : value] as [string, typeof value]),
});

export function pizzaBoxSheetV4(input: CartonDimensions) {
  return pizzaBoxV4.sheet(input);
}
