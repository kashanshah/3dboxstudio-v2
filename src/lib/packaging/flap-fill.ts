import { defaultArtworkPlacement, type ArtworkByPanel, type ArtworkPlacement } from './artwork';
import type { DielinePanel } from './box-structures';
import type { CartonDimensions } from './reverse-tuck';
import { layerPrintsOn, sheetTransformToPhysical, type FullDielineArtworkLayer } from './full-dieline-artwork';
import { getTemplateGeometry, getTemplateRuntime, type TemplateGeometryOptions } from './template-runtime';
import { inheritedFlaps, panelName } from './flap-artwork';
import { dominantColour, edgeBand } from './flap-continuation';

// Drawing a panel's printed artwork onto a canvas, in the panel's own
// millimetres, and the solid colour each empty flap takes from it. The print
// file draws panels with the same code, so the 2D grid, the 3D model and the
// PDF agree on every flap.

/** Draws explicit panel artwork into a width × height panel. */
export function drawPanelArtwork(ctx: CanvasRenderingContext2D, artwork: ArtworkPlacement, image: HTMLImageElement, width: number, height: number) {
  ctx.save();
  if (artwork.transform) {
    const t = artwork.transform;
    ctx.translate(width * t.x / 100, height * t.y / 100);
    ctx.rotate(t.rotation * Math.PI / 180);
    ctx.drawImage(image, -width * t.width / 200, -height * t.height / 200, width * t.width / 100, height * t.height / 100);
  } else {
    const anchorX = width * (artwork.alignX + 1) / 2;
    const anchorY = height * (artwork.alignY + 1) / 2;
    ctx.translate(anchorX, anchorY);
    ctx.rotate(artwork.rotation * Math.PI / 180);
    if (artwork.mode !== 'tile') ctx.scale(artwork.scale / 100, artwork.scale / 100);
    ctx.translate(-anchorX, -anchorY);
    if (artwork.crop) {
      const c = artwork.crop;
      ctx.drawImage(image, c.x * image.naturalWidth, c.y * image.naturalHeight, c.width * image.naturalWidth, c.height * image.naturalHeight, 0, 0, width, height);
    } else if (artwork.panelTexture) {
      ctx.drawImage(image, 0, 0, width, height);
    } else if (artwork.mode === 'tile') {
      const tileWidth = width * Math.max(12, 10000 / Math.max(25, artwork.scale)) / 100;
      const tileHeight = tileWidth * image.naturalHeight / image.naturalWidth;
      const pattern = ctx.createPattern(image, 'repeat');
      if (!pattern) throw new Error('Could not prepare tiled artwork.');
      const x = (width - tileWidth) * (artwork.alignX + 1) / 2;
      const y = (height - tileHeight) * (artwork.alignY + 1) / 2;
      pattern.setTransform(new DOMMatrix([tileWidth / image.naturalWidth, 0, 0, tileHeight / image.naturalHeight, x, y]));
      ctx.fillStyle = pattern;
      // Callers clip to the panel (the PDF's mask includes bleed).
      ctx.fillRect(-width * 2, -height * 2, width * 5, height * 5);
    } else {
      const ratio = artwork.mode === 'fill'
        ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
        : Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * ratio, h = image.naturalHeight * ratio;
      ctx.drawImage(image, (width - w) * (artwork.alignX + 1) / 2, (height - h) * (artwork.alignY + 1) / 2, w, h);
    }
  }
  ctx.restore();
}

/**
 * Draws what prints on `panel`, with the canvas in the panel's millimetres
 * (0,0 at its top-left on the sheet): its own artwork when it has some, else
 * the sheet layers that print on it.
 */
export function drawPanelPrint(
  ctx: CanvasRenderingContext2D,
  panel: DielinePanel,
  bounds: { width: number; height: number },
  explicit: { placement: ArtworkPlacement; image: HTMLImageElement } | null,
  layers: { layer: FullDielineArtworkLayer; image: HTMLImageElement }[],
) {
  ctx.save();
  if (explicit) {
    // Panel artwork is oriented to the folded box; a panel printed upside
    // down on the sheet takes it turned half a turn.
    if (panel.artworkRotation === 180) {
      ctx.translate(panel.width, panel.height);
      ctx.rotate(Math.PI);
    }
    drawPanelArtwork(ctx, explicit.placement, explicit.image, panel.width, panel.height);
  } else {
    for (const { layer, image } of layers) {
      if (!layerPrintsOn(layer, panel.id)) continue;
      const t = sheetTransformToPhysical(layer.transform, bounds);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, (layer.opacity ?? 100) / 100));
      ctx.translate(t.centerX - panel.x, t.centerY - panel.y);
      ctx.rotate(t.rotation * Math.PI / 180);
      ctx.drawImage(image, -t.width / 2, -t.height / 2, t.width, t.height);
      ctx.restore();
    }
  }
  ctx.restore();
}

export type FlapFillInput = {
  templateId: string;
  dimensions: CartonDimensions;
  geometryOptions?: TemplateGeometryOptions;
  layers: FullDielineArtworkLayer[];
  artworkByPanel: ArtworkByPanel;
  scope: 'outside' | 'inside';
};

/** Longest side of the canvas an edge band is read from, in pixels. */
const BAND_PIXELS = 256;

/**
 * Flap id → the solid colour a flap with no artwork of its own prints in: the
 * colour that dominates its source panel's artwork along their crease. Flaps
 * whose source edge is mostly unprinted are left out and stay plain board.
 */
export async function flapFillColours(input: FlapFillInput, getImage: (url: string) => Promise<HTMLImageElement>): Promise<Record<string, string>> {
  const runtime = getTemplateRuntime(input.templateId);
  if (!runtime?.flapArtworkSources) return {};
  const { panels, bounds } = getTemplateGeometry(input.templateId, input.dimensions, input.geometryOptions);
  const visible = input.layers.filter(layer => layer.visible !== false && (layer.opacity ?? 100) > 0);
  const prefix = input.scope === 'inside' ? 'Interior ' : '';
  const flaps = inheritedFlaps(runtime.flapArtworkSources, panels, bounds, visible, input.artworkByPanel, prefix);
  const result: Record<string, string> = {};
  if (!flaps.length) return result;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return result;
  try {
    for (const { flap, source, crease } of flaps) {
      try {
        const placement = input.artworkByPanel[`${prefix}${panelName(source.label)}`];
        const explicit = placement ? { placement, image: await getImage(placement.url) } : null;
        const layers = explicit ? [] : await Promise.all(visible.map(async layer => ({ layer, image: await getImage(layer.url) })));
        const band = edgeBand(source, crease);
        const pixelsPerMm = BAND_PIXELS / Math.max(band.width, band.height);
        canvas.width = Math.max(1, Math.round(band.width * pixelsPerMm));
        canvas.height = Math.max(1, Math.round(band.height * pixelsPerMm));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(canvas.width / band.width, canvas.height / band.height);
        ctx.translate(source.x - band.x, source.y - band.y);
        drawPanelPrint(ctx, source, bounds, explicit, layers);
        const colour = dominantColour(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
        if (colour) result[flap.id] = colour;
      } catch {
        // Artwork that cannot be read leaves its flap plain.
      }
    }
  } finally {
    canvas.width = canvas.height = 0;
  }
  return result;
}

/** An image loader for flapFillColours that reads each url once. */
export function artworkImageLoader() {
  const images = new Map<string, Promise<HTMLImageElement>>();
  return (url: string) => {
    let image = images.get(url);
    if (!image) {
      image = new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        // The colour is read back from a canvas, which cross-origin images taint.
        element.crossOrigin = 'anonymous';
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Could not load artwork image.'));
        element.src = url;
      });
      images.set(url, image);
    }
    return image;
  };
}

/**
 * Flap fills as plain panel textures for the 3D model, keyed by artwork name
 * ("Top Tuck", "Interior Top Tuck").
 */
export function flapFillTextures(fills: Record<string, string>, panels: DielinePanel[], prefix: string): ArtworkByPanel {
  const result: ArtworkByPanel = {};
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4;
  const ctx = canvas.getContext('2d');
  if (!ctx) return result;
  for (const panel of panels) {
    const colour = fills[panel.id];
    if (!colour) continue;
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 4, 4);
    result[`${prefix}${panelName(panel.label)}`] = {
      ...defaultArtworkPlacement(`${panelName(panel.label)} fill`, canvas.toDataURL('image/png')),
      panelTexture: true,
      mode: 'fill',
    };
  }
  return result;
}
