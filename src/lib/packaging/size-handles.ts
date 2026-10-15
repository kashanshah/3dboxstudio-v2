import type { MeasuredSize, PanelSizes } from './parametric/sheet';

// Where the drag handles for a box's sizes sit on the flat sheet. The box's
// width, height and depth get handles on every side of the box (each body
// panel), on both of the panel's edges along that size: the edge that moves
// when the size grows, and the opposite one, so a height can be dragged from
// the top as well as the bottom. A flap size gets one handle, on the free
// edge of its largest flap (the edge facing away from the body panels).
// Dragging a handle outwards makes the size bigger, one for one; the panel's
// other edge stays put. Handles that would land on the same spot are shown
// once, and the edges that move come first, so where two panels share a
// crease it keeps the handle of the size that moves it.

type Panel = { id: string; kind: string; x: number; y: number; width: number; height: number };

export type SizeHandle = {
  id: string;
  size: MeasuredSize;
  axis: 'x' | 'y';
  /** +1 when dragging right or down makes the size bigger. */
  direction: 1 | -1;
  /** The handle, in sheet millimetres. */
  x: number;
  y: number;
  panel: string;
  /** The panel's other edge on the handle's axis: it stays put while dragging. */
  anchor: number;
};

/**
 * @param grownPanels the sheet's panels with one size a millimetre bigger
 * (or smaller, at its maximum), to see which edges a size moves.
 */
export function placeSizeHandles(panels: Panel[], panelSizes: PanelSizes[], grownPanels: (size: MeasuredSize) => Panel[] | null): SizeHandle[] {
  const bodies = panels.filter((panel) => panel.kind === 'body');
  if (!bodies.length) return [];
  const centre = {
    x: bodies.reduce((sum, panel) => sum + panel.x + panel.width / 2, 0) / bodies.length,
    y: bodies.reduce((sum, panel) => sum + panel.y + panel.height / 2, 0) / bodies.length,
  };
  const rank = (panel: Panel) => (panel.kind === 'body' ? 1e12 : 0) + panel.width * panel.height;
  const grown = new Map<string, Panel[] | null>();
  const grownSheet = (size: MeasuredSize) => {
    if (!grown.has(size.key)) grown.set(size.key, grownPanels(size));
    return grown.get(size.key);
  };
  const candidates = panelSizes.flatMap((entry) => (['x', 'y'] as const).flatMap((axis) => {
    const size = entry[axis];
    const panel = panels.find((item) => item.id === entry.panel);
    if (!size || !panel || size.max - size.min < 0.5 || (axis === 'x' ? panel.height : panel.width) < 4) return [];
    if (size.kind === 'dimension' && panel.kind !== 'body') return [];
    return [{ panel, axis, size }];
  })).map((entry, order) => ({ ...entry, order }));
  // A flap size's largest flap; of flaps the same size, the first on the sheet.
  const flapFor = new Map<string, (typeof candidates)[number]>();
  for (const entry of candidates) {
    if (entry.size.kind === 'dimension') continue;
    const current = flapFor.get(entry.size.key);
    if (!current || rank(entry.panel) > rank(current.panel) + 1) flapFor.set(entry.size.key, entry);
  }
  // Bigger panels claim a spot first when two handles would share it.
  const entries = candidates
    .filter((entry) => entry.size.kind === 'dimension' || flapFor.get(entry.size.key) === entry)
    .sort((a, b) => Math.abs(rank(b.panel) - rank(a.panel)) > 1 ? rank(b.panel) - rank(a.panel) : a.order - b.order);
  const handles: (SizeHandle & { order: number })[] = [];
  const free = (axis: 'x' | 'y', x: number, y: number) => !handles.some((item) => item.axis === axis && Math.hypot(item.x - x, item.y - y) < 6);
  const opposite: (SizeHandle & { order: number })[] = [];
  for (const { panel, axis, size, order } of entries) {
    let low = axis === 'x' ? panel.x + panel.width / 2 < centre.x : panel.y + panel.height / 2 < centre.y;
    if (size.kind === 'dimension') {
      const moved = grownSheet(size)?.find((item) => item.id === panel.id);
      if (moved) {
        const lowShift = axis === 'x' ? panel.x - moved.x : panel.y - moved.y;
        const highShift = axis === 'x' ? moved.x + moved.width - panel.x - panel.width : moved.y + moved.height - panel.y - panel.height;
        low = Math.abs(lowShift) > Math.abs(highShift) + 1e-6;
      }
    }
    const place = axis === 'x'
      ? { x: low ? panel.x : panel.x + panel.width, y: panel.y + panel.height / 2, anchor: low ? panel.x + panel.width : panel.x }
      : { x: panel.x + panel.width / 2, y: low ? panel.y : panel.y + panel.height, anchor: low ? panel.y + panel.height : panel.y };
    if (size.kind === 'dimension') {
      // The other edge: dragging it outwards grows the size too, while the moving edge stays put.
      const other = axis === 'x'
        ? { x: place.anchor, y: place.y, anchor: low ? panel.x : panel.x + panel.width }
        : { x: place.x, y: place.anchor, anchor: low ? panel.y : panel.y + panel.height };
      opposite.push({ id: `${size.key}:${panel.id}:${axis}:far`, size, axis, direction: low ? 1 : -1, panel: panel.id, order: order + 0.5, ...other });
    }
    if (!free(axis, place.x, place.y)) continue;
    handles.push({ id: `${size.key}:${panel.id}:${axis}`, size, axis, direction: low ? -1 : 1, panel: panel.id, order, ...place });
  }
  for (const handle of opposite) if (free(handle.axis, handle.x, handle.y)) handles.push(handle);
  // In the sheet's own order, which does not change as sizes do: a handle
  // that moved in the page would lose the pointer mid-drag.
  return handles.sort((a, b) => a.order - b.order).map(({ order, ...handle }) => { void order; return handle; });
}
