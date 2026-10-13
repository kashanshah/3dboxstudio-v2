import type { CartonDimensions } from '../../reverse-tuck';
import { compileParametricSheet } from '@/lib/packaging/parametric/sheet';
import { pizzaBoxDefinition } from '@/lib/packaging/parametric/definitions/pizza-box';

// The pizza box's design grid as it stood for layout version 3: the current
// die with the lid a board shorter (depth − 2t). Saved designs move from it
// onto the current grid.

const pizzaBoxV3 = compileParametricSheet({
  ...pizzaBoxDefinition,
  derived: pizzaBoxDefinition.derived.map(([key, value]) => [key, key === 'lidDepth' ? 'depth - 2 * t' : value] as [string, typeof value]),
});

export function pizzaBoxSheetV3(input: CartonDimensions) {
  return pizzaBoxV3.sheet(input);
}
