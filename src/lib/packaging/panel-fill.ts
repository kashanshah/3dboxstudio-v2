import type { FullDielineArtworkLayer } from './full-dieline-artwork';

// Panel colours. A panel colour is an ordinary artwork layer: a solid colour
// image limited to one panel (layer.panels), drawn a little past the panel's
// edges so the bleed is covered, so the sheet, the 3D box and every export
// show it with no extra code paths.

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Past each edge of the panel, in mm: the print bleed, and cover for crease rounding. */
export const FILL_OVERLAP_MM = 3;

export function isFill(value: unknown): value is { color: string } {
  return !!value && typeof value === 'object' && typeof (value as { color?: unknown }).color === 'string' && HEX.test((value as { color: string }).color);
}

/** A stretchable one-colour image. */
export function fillUrl(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" preserveAspectRatio="none"><rect width="16" height="16" fill="${HEX.test(color) ? color : '#ffffff'}"/></svg>`;
  return `data:image/svg+xml;base64,${typeof btoa === 'function' ? btoa(svg) : Buffer.from(svg).toString('base64')}`;
}

/** A layer that colours one panel of the sheet. */
export function panelFillLayer(
  id: string,
  panel: { id: string; x: number; y: number; width: number; height: number },
  panelName: string,
  bounds: { width: number; height: number },
  color: string,
): FullDielineArtworkLayer {
  const width = panel.width + 2 * FILL_OVERLAP_MM, height = panel.height + 2 * FILL_OVERLAP_MM;
  return {
    id,
    name: `${panelName} colour`,
    url: fillUrl(color),
    aspectRatio: width / height,
    fill: { color },
    panels: [panel.id],
    transform: panelFillTransform(panel, bounds),
  };
}

/** Where a panel colour sits: over the panel and its overlap, as a share of the sheet. */
export function panelFillTransform(
  panel: { x: number; y: number; width: number; height: number },
  bounds: { width: number; height: number },
): FullDielineArtworkLayer['transform'] {
  return {
    x: (panel.x + panel.width / 2) / bounds.width * 100,
    y: (panel.y + panel.height / 2) / bounds.height * 100,
    width: (panel.width + 2 * FILL_OVERLAP_MM) / bounds.width * 100,
    height: (panel.height + 2 * FILL_OVERLAP_MM) / bounds.height * 100,
    rotation: 0,
  };
}

/**
 * A layer with a new transform. A panel colour stays on its panel only while
 * it sits where Fill panel put it: once moved, resized or rotated it is a
 * colour block like any artwork, clipped at the box's outline, not the panel's.
 */
export function withTransform(layer: FullDielineArtworkLayer, transform: FullDielineArtworkLayer['transform']): FullDielineArtworkLayer {
  const before = layer.transform;
  const moved = (['x', 'y', 'width', 'height', 'rotation'] as const).some(key => Math.abs(before[key] - transform[key]) > 1e-9);
  if (!layer.fill || !layer.panels || !moved) return { ...layer, transform };
  const { panels: _panels, ...free } = layer;
  void _panels;
  return { ...free, transform };
}
