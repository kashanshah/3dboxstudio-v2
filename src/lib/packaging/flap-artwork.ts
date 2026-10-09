import type { DielinePanel } from './box-structures';
import type { ArtworkByPanel } from './artwork';
import { layerOverlaps, layerPrintsOn, type FullDielineArtworkLayer } from './full-dieline-artwork';

// Closure flaps that carry no artwork of their own continue the panel they
// fold from, mirrored across the crease, the way printers bleed artwork over
// a fold. The 2D grid, the 3D textures and the print file all use this.

type Point = { x: number; y: number };
type Bounds = { width: number; height: number };

export type InheritedFlap = {
  flap: DielinePanel;
  source: DielinePanel;
  /** Mirrors a sheet point across the crease the flap shares with its source. */
  mirror: (point: Point) => Point;
  /** The crease: horizontal (at y) or vertical (at x). */
  crease: { axis: 'x' | 'y'; at: number };
};

export const panelName = (label: string) => label.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

/** Whether any visible sheet layer prints somewhere over this panel. */
export function layersReach(panel: DielinePanel, layers: FullDielineArtworkLayer[], bounds: Bounds) {
  return layers.some(layer => {
    return layer.visible !== false && (layer.opacity ?? 100) > 0 && layerPrintsOn(layer, panel.id) && layerOverlaps(layer, panel, bounds);
  });
}

/**
 * The flaps that show their source panel's artwork: those with neither
 * artwork of their own nor any sheet layer reaching them. `prefix` is
 * "Interior " for the inside print.
 */
export function inheritedFlaps(
  sources: Record<string, string> | undefined,
  panels: DielinePanel[],
  bounds: Bounds,
  layers: FullDielineArtworkLayer[],
  artworkByPanel: ArtworkByPanel,
  prefix = '',
): InheritedFlap[] {
  if (!sources) return [];
  const result: InheritedFlap[] = [];
  for (const flap of panels) {
    const source = panels.find(panel => panel.id === sources[flap.id]);
    if (!source || artworkByPanel[`${prefix}${panelName(flap.label)}`] || layersReach(flap, layers, bounds)) continue;
    const crease = sharedCrease(flap, source);
    if (!crease) continue;
    const mirror = crease.axis === 'y'
      ? (point: Point) => ({ x: point.x, y: 2 * crease.at - point.y })
      : (point: Point) => ({ x: 2 * crease.at - point.x, y: point.y });
    result.push({ flap, source, mirror, crease });
  }
  return result;
}

function sharedCrease(flap: DielinePanel, source: DielinePanel): InheritedFlap['crease'] | null {
  const eps = 1e-6;
  const overlapX = Math.min(flap.x + flap.width, source.x + source.width) - Math.max(flap.x, source.x);
  const overlapY = Math.min(flap.y + flap.height, source.y + source.height) - Math.max(flap.y, source.y);
  if (overlapX > eps && Math.abs(flap.y + flap.height - source.y) < eps) return { axis: 'y', at: source.y };
  if (overlapX > eps && Math.abs(source.y + source.height - flap.y) < eps) return { axis: 'y', at: flap.y };
  if (overlapY > eps && Math.abs(flap.x + flap.width - source.x) < eps) return { axis: 'x', at: source.x };
  if (overlapY > eps && Math.abs(source.x + source.width - flap.x) < eps) return { axis: 'x', at: flap.x };
  return null;
}
