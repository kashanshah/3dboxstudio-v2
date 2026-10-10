import type { ArtworkPlacement } from './artwork';
import type { DielinePanel } from './box-structures';
import { layerPrintsOn, sheetTransformToPhysical, type FullDielineArtworkLayer } from './full-dieline-artwork';

// Drawing a panel's printed artwork onto a canvas, in the panel's own
// millimetres. A panel with no artwork prints nothing: it shows the board,
// in the material or colour chosen for the box.

/** A panel's artwork name ("Top Tuck") from its label ("TOP TUCK"). */
export const panelName = (label: string) => label.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

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
