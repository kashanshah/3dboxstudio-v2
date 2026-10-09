import type { DielinePanel } from './box-structures';
import type { ArtworkByPanel } from './artwork';
import { layerOverlaps, layerPrintsOn, type FullDielineArtworkLayer } from './full-dieline-artwork';
import { continuationChain, type Crease } from './flap-continuation';

// Closure flaps (and an empty bottom) print in a neighbour's edge colour
// wherever their own artwork leaves them bare, see flap-continuation.ts and
// flap-fill.ts. The 2D grid, the 3D model and the print file all use this.

type Bounds = { width: number; height: number };

export type FlapChain = {
  flap: DielinePanel;
  /**
   * The neighbours whose edge the flap can take, nearest first, each with
   * the crease the edge is read along; only those that carry artwork.
   */
  chain: { source: DielinePanel; crease: Crease }[];
};

export const panelName = (label: string) => label.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

/** Whether any visible sheet layer prints somewhere over this panel. */
export function layersReach(panel: DielinePanel, layers: FullDielineArtworkLayer[], bounds: Bounds) {
  return layers.some(layer => layer.visible !== false && (layer.opacity ?? 100) > 0 && layerPrintsOn(layer, panel.id) && layerOverlaps(layer, panel, bounds));
}

/**
 * The flaps that print in a neighbour's edge colour wherever their own
 * artwork leaves them bare: every flap with a source and no panel artwork of
 * its own (sheet layers may still cover part of it). `prefix` is "Interior "
 * for the inside print.
 */
export function flapChains(
  sources: Record<string, string> | undefined,
  panels: DielinePanel[],
  bounds: Bounds,
  layers: FullDielineArtworkLayer[],
  artworkByPanel: ArtworkByPanel,
  prefix = '',
): FlapChain[] {
  if (!sources) return [];
  const own = (panel: DielinePanel) => !!artworkByPanel[`${prefix}${panelName(panel.label)}`];
  const hasArtwork = (panel: DielinePanel) => own(panel) || layersReach(panel, layers, bounds);
  const byId = new Map(panels.map(panel => [panel.id, panel]));
  return panels.flatMap(flap => {
    if (!sources[flap.id] || own(flap)) return [];
    const chain = continuationChain(flap, id => byId.get(sources[id])).filter(item => hasArtwork(item.source));
    return chain.length ? [{ flap, chain }] : [];
  });
}
