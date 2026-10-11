import type { FullDielineTransform } from './full-dieline-artwork';

// Snapping and alignment for artwork on the design sheet. Everything is in
// millimetres on the area the transform is a percentage of: the whole sheet
// for full-sheet layers, or one panel for artwork placed on a single side.

export type Size = { width: number; height: number };
export type Box = { x: number; y: number; width: number; height: number };
export type SnapLines = { x: number[]; y: number[] };

/** The box the artwork covers, turned by its rotation, in mm. */
export function artworkBox(transform: FullDielineTransform, area: Size) {
  const width = transform.width / 100 * area.width, height = transform.height / 100 * area.height;
  const angle = transform.rotation * Math.PI / 180;
  const halfWidth = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height) / 2;
  const halfHeight = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height) / 2;
  const centerX = transform.x / 100 * area.width, centerY = transform.y / 100 * area.height;
  return { left: centerX - halfWidth, right: centerX + halfWidth, top: centerY - halfHeight, bottom: centerY + halfHeight, centerX, centerY };
}

/** Edges and centres to snap to: the area itself and each panel on it. */
export function snapLines(area: Size, panels: Box[] = []): SnapLines {
  const x = new Set<number>([0, area.width / 2, area.width]);
  const y = new Set<number>([0, area.height / 2, area.height]);
  for (const panel of panels) {
    for (const value of [panel.x, panel.x + panel.width / 2, panel.x + panel.width]) x.add(Math.round(value * 1000) / 1000);
    for (const value of [panel.y, panel.y + panel.height / 2, panel.y + panel.height]) y.add(Math.round(value * 1000) / 1000);
  }
  return { x: [...x].sort((a, b) => a - b), y: [...y].sort((a, b) => a - b) };
}

/** The smallest move (within `threshold`) that puts one of `own` on one of `targets`. */
function nearest(own: number[], targets: number[], threshold: number) {
  let best: { shift: number; line: number } | null = null;
  for (const value of own) for (const target of targets) {
    const shift = target - value;
    if (Math.abs(shift) <= threshold && (!best || Math.abs(shift) < Math.abs(best.shift))) best = { shift, line: target };
  }
  return best;
}

/**
 * Moves a dragged artwork so its nearest edge or centre lands on a snap line
 * when one is within `thresholdMm`, each axis on its own. Returns the
 * snapped transform and the lines it snapped to, for drawing guides.
 */
export function snapMove(transform: FullDielineTransform, area: Size, lines: SnapLines, thresholdMm: number) {
  const box = artworkBox(transform, area);
  const snapX = nearest([box.left, box.centerX, box.right], lines.x, thresholdMm);
  const snapY = nearest([box.top, box.centerY, box.bottom], lines.y, thresholdMm);
  return {
    transform: {
      ...transform,
      x: snapX ? transform.x + snapX.shift / area.width * 100 : transform.x,
      y: snapY ? transform.y + snapY.shift / area.height * 100 : transform.y,
    },
    guides: { x: snapX ? [snapX.line] : [], y: snapY ? [snapY.line] : [] },
  };
}

export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** The panel under the artwork's centre, or the whole area when there is none. */
export function panelUnder(transform: FullDielineTransform, area: Size, panels: Box[]): Box {
  const x = transform.x / 100 * area.width, y = transform.y / 100 * area.height;
  return panels.find(panel => x >= panel.x && x <= panel.x + panel.width && y >= panel.y && y <= panel.y + panel.height)
    ?? { x: 0, y: 0, width: area.width, height: area.height };
}

/** Lines the artwork's box up with an edge or the centre of `target`. */
export function alignTo(transform: FullDielineTransform, area: Size, target: Box, alignment: Alignment): FullDielineTransform {
  const box = artworkBox(transform, area);
  let dx = 0, dy = 0;
  if (alignment === 'left') dx = target.x - box.left;
  if (alignment === 'center') dx = target.x + target.width / 2 - box.centerX;
  if (alignment === 'right') dx = target.x + target.width - box.right;
  if (alignment === 'top') dy = target.y - box.top;
  if (alignment === 'middle') dy = target.y + target.height / 2 - box.centerY;
  if (alignment === 'bottom') dy = target.y + target.height - box.bottom;
  return { ...transform, x: transform.x + dx / area.width * 100, y: transform.y + dy / area.height * 100 };
}
