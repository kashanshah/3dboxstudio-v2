import type { FullDielineArtworkLayer } from './full-dieline-artwork';
import { panelFillTransform } from './panel-fill';

// What happens to sheet artwork when the box changes size. Artwork is stored
// as a share of the whole sheet, so without this every image would stretch
// with the sheet. Instead each image keeps its printed size and its place on
// the panel it sits on; only the artwork being edited (the selected layer)
// still stretches with the box, a panel colour refits its panel, and artwork
// that covers the whole sheet keeps covering it.

type Rect = { id: string; x: number; y: number; width: number; height: number };
export type ResizeSheet = { bounds: { width: number; height: number }; panels: Rect[] };

function panelUnderPoint(panels: Rect[], x: number, y: number): Rect | null {
  const inside = panels.filter((p) => x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height);
  // Panels can share an edge; the smallest is the most specific.
  if (inside.length) return inside.reduce((a, b) => (a.width * a.height <= b.width * b.height ? a : b));
  let best: Rect | null = null, bestDistance = Infinity;
  for (const p of panels) {
    const dx = Math.max(p.x - x, 0, x - (p.x + p.width)), dy = Math.max(p.y - y, 0, y - (p.y + p.height));
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) { best = p; bestDistance = distance; }
  }
  return best;
}

export function keepArtworkOnResize(
  layers: FullDielineArtworkLayer[],
  before: ResizeSheet,
  after: ResizeSheet,
  stretch: ReadonlySet<string> = new Set(),
): FullDielineArtworkLayer[] {
  const same = before.bounds.width === after.bounds.width && before.bounds.height === after.bounds.height
    && before.panels.every((p) => { const q = after.panels.find((item) => item.id === p.id); return q && q.x === p.x && q.y === p.y && q.width === p.width && q.height === p.height; });
  if (same) return layers;
  return layers.map((layer) => {
    if (stretch.has(layer.id)) return layer;
    const t = layer.transform;
    if (layer.fill && layer.panels?.length === 1) {
      const panel = after.panels.find((p) => p.id === layer.panels![0]);
      return panel ? { ...layer, transform: { ...panelFillTransform(panel, after.bounds), rotation: t.rotation } } : layer;
    }
    const width = before.bounds.width * t.width / 100, height = before.bounds.height * t.height / 100;
    // Artwork that covers the whole sheet (Fill artboard) keeps covering it.
    if (width >= before.bounds.width - 0.5 && height >= before.bounds.height - 0.5) return layer;
    const cx = before.bounds.width * t.x / 100, cy = before.bounds.height * t.y / 100;
    const home = panelUnderPoint(before.panels, cx, cy);
    const next = home && after.panels.find((p) => p.id === home.id);
    if (!home || !next) return layer;
    const u = home.width > 0 ? (cx - home.x) / home.width : 0.5;
    const v = home.height > 0 ? (cy - home.y) / home.height : 0.5;
    return {
      ...layer,
      transform: {
        ...t,
        x: (next.x + u * next.width) / after.bounds.width * 100,
        y: (next.y + v * next.height) / after.bounds.height * 100,
        width: width / after.bounds.width * 100,
        height: height / after.bounds.height * 100,
      },
    };
  });
}
