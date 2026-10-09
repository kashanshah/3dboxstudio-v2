import type { DielinePanel } from './box-structures';
import type { ArtworkByPanel } from './artwork';
import { layerOverlaps, layerPrintsOn, type FullDielineArtworkLayer } from './full-dieline-artwork';
import { continuationChain, type Crease } from './flap-continuation';

// Panels that carry no artwork of their own (closure flaps, or an empty
// bottom) continue a neighbour's artwork across the crease, see
// flap-continuation.ts. The 2D grid, the 3D textures and the print file all
// use this.

type Bounds = { width: number; height: number };

export type InheritedFlap = {
  flap: DielinePanel;
  /** The neighbour whose artwork is continued over the flap. */
  source: DielinePanel;
  crease: Crease;
  /** The flap shows the source's edge strip stretched by this factor. */
  stretch: number;
};

export const panelName = (label: string) => label.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

/** Whether any visible sheet layer prints somewhere over this panel. */
export function layersReach(panel: DielinePanel, layers: FullDielineArtworkLayer[], bounds: Bounds) {
  return layers.some(layer => layer.visible !== false && (layer.opacity ?? 100) > 0 && layerPrintsOn(layer, panel.id) && layerOverlaps(layer, panel, bounds));
}

/**
 * The panels that continue a neighbour's artwork: those with neither artwork
 * of their own nor any sheet layer reaching them, each with the nearest
 * neighbour that has some. `prefix` is "Interior " for the inside print.
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
  const hasArtwork = (panel: DielinePanel) => !!artworkByPanel[`${prefix}${panelName(panel.label)}`] || layersReach(panel, layers, bounds);
  const byId = new Map(panels.map(panel => [panel.id, panel]));
  const result: InheritedFlap[] = [];
  for (const flap of panels) {
    if (!sources[flap.id] || hasArtwork(flap)) continue;
    const found = continuationChain(flap, id => byId.get(sources[id])).find(item => hasArtwork(item.source));
    if (found) result.push({ flap, ...found });
  }
  return result;
}
