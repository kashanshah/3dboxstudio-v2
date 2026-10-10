import type { ArtworkRegionDefinition } from '../../template-registry';

// Artwork regions shared by the templates' catalog entries: each names a
// panel (or its inside, "Interior …") that artwork can be placed on.

/** Outside and inside regions for panels named `labels` ("Top Front" → outside-top-front, inside-top-front). */
export function panelRegions(labels: string[], surfaces: ('outside' | 'inside')[] = ['outside', 'inside']): ArtworkRegionDefinition[] {
  const slug = (label: string) => label.toLowerCase().replaceAll(' ', '-');
  return surfaces.flatMap(surface => labels.map(label => surface === 'outside'
    ? { id: `outside-${slug(label)}`, label, surface, panelId: label }
    : { id: `inside-${slug(label)}`, label: `Inside ${label}`, surface, panelId: `Interior ${label}` }));
}

/** The six faces of a box, outside then inside. */
export const BOX_FACES = ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'];

/** Outside and inside regions for each of `labels` in turn (outside-x, inside-x, outside-y, …). */
export function pairedPanelRegions(labels: string[]): ArtworkRegionDefinition[] {
  return labels.flatMap(label => panelRegions([label]));
}
