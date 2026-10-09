import { DEFAULT_CARTON_DIMENSIONS, type CartonDimensions } from '../reverse-tuck';

/** Corrugated board runs much thicker than folding board: up to double wall. */
export const CORRUGATED_MAX_BOARD_MM = 7;

/** Sizes for a corrugated template: any positive size, board up to 7 mm. */
export function sanitizeCorrugatedDimensions(value: CartonDimensions, defaultThickness: number): CartonDimensions {
  const size = (entry: number, fallback: number) => (Number.isFinite(entry) ? Math.max(1, entry) : fallback);
  return {
    width: size(value.width, DEFAULT_CARTON_DIMENSIONS.width),
    height: size(value.height, DEFAULT_CARTON_DIMENSIONS.height),
    depth: size(value.depth, DEFAULT_CARTON_DIMENSIONS.depth),
    thickness: Number.isFinite(value.thickness) ? Math.min(CORRUGATED_MAX_BOARD_MM, Math.max(0.3, value.thickness)) : defaultThickness,
  };
}
