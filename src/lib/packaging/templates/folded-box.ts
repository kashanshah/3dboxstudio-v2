import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { DielinePanel } from '@/lib/packaging/box-structures';
import type { SheetPanel } from '@/lib/packaging/fold-sheet';

// Shared pieces for templates folded from rectangular dieline panels.

/** Board thickness used for the 3D fold, kept in proportion on small boxes. */
export function boardThickness(d: CartonDimensions) {
  return Math.max(0.05, Math.min(d.thickness, Math.min(d.width, d.depth) * 0.08));
}

/** "BOTTOM FRONT" → "Bottom Front", the artwork and picking name. */
export function panelName(label: string) {
  return label.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

export function rectangleSheetPanels(panels: DielinePanel[]): SheetPanel[] {
  return panels.map(panel => ({
    id: panel.id,
    name: panelName(panel.label),
    outline: [
      { x: panel.x, y: panel.y },
      { x: panel.x + panel.width, y: panel.y },
      { x: panel.x + panel.width, y: panel.y + panel.height },
      { x: panel.x, y: panel.y + panel.height },
    ],
  }));
}

/** Smooth 0 → 1 as `value` runs from `start` to `end`. */
export function substage(value: number, start: number, end: number) {
  const x = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return x * x * (3 - 2 * x);
}
