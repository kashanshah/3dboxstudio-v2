import type { ArtworkByPanel, ArtworkPlacement } from './artwork';
import { sheetTransformToPhysical, type FullDielineArtworkLayer } from './full-dieline-artwork';
import { getTemplateExportGeometry, getTemplateGeometry, type TemplateGeometryOptions } from './template-runtime';
import type { CartonDimensions } from './reverse-tuck';
import { validatePdfOptions, validatePdfDimensions, type DielinePdfOptions } from './pdf-options';
import type { ExportPanel, LineMm } from './export-geometry';
import { createDielinePdf, type PdfPanelImage } from './dieline-pdf';

type DownloadInput = {
  templateId: string;
  dimensions: CartonDimensions;
  geometryOptions: TemplateGeometryOptions;
  layers: FullDielineArtworkLayer[];
  artworkByPanel: ArtworkByPanel;
  scope: 'outside' | 'inside';
  baseColor?: string | null;
  options: DielinePdfOptions;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => image.decode().then(() => resolve(image), () => reject(new Error('Could not decode artwork. Retry after the image has loaded.')));
    image.onerror = () => reject(new Error('Could not load artwork for PDF. Retry or export without artwork.'));
    image.src = url;
  });
}

function drawPanelArtwork(ctx: CanvasRenderingContext2D, artwork: ArtworkPlacement, image: HTMLImageElement, width: number, height: number) {
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
      // The mask below provides the exact final clipping, including bleed.
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

function panelCutEdges(panel: ExportPanel, cut: LineMm[]) {
  const onSegment = (point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs((point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)) < 1e-5
      && point.x >= Math.min(a.x, b.x) - 1e-7 && point.x <= Math.max(a.x, b.x) + 1e-7
      && point.y >= Math.min(a.y, b.y) - 1e-7 && point.y <= Math.max(a.y, b.y) + 1e-7;
  return cut.filter(line => panel.outline.some((a, i) => {
    const b = panel.outline[(i + 1) % panel.outline.length];
    return onSegment(line.start, a, b) && onSegment(line.end, a, b);
  }));
}

/** Rasterizes artwork only. Cutting and creasing geometry never touches a canvas. */
export function preparePdfArtwork(input: DownloadInput) {
  validatePdfOptions(input.options);
  validatePdfDimensions(input.dimensions);
  const geometry = getTemplateExportGeometry(input.templateId, input.dimensions, input.geometryOptions);
  const source = getTemplateGeometry(input.templateId, input.dimensions, input.geometryOptions);
  const images = new Map<string, Promise<HTMLImageElement>>();
  const getImage = (url: string) => {
    let image = images.get(url);
    if (!image) { image = loadImage(url); images.set(url, image); }
    return image;
  };
  const visible = input.layers.filter(layer => layer.visible !== false && (layer.opacity ?? 100) > 0);
  return { geometry, renderPanel: async (index: number): Promise<PdfPanelImage | null> => {
    const panel = geometry.panels[index];
    const original = source.panels.find(p => p.id === panel.sourceId);
    const panelName = original?.label.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
    const explicit = panelName ? input.artworkByPanel[input.scope === 'inside' ? `Interior ${panelName}` : panelName] : undefined;
    if (!input.baseColor && (!original || (!visible.length && !explicit))) return null;
    const bleed = input.options.bleedMm;
    const w = panel.width + 2 * bleed, h = panel.height + 2 * bleed;
    const pixelsPerMm = Math.min(300 / 25.4, 4096 / Math.max(w, h), Math.sqrt(16_000_000 / (w * h)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * pixelsPerMm));
    canvas.height = Math.max(1, Math.round(h * pixelsPerMm));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable. Export without artwork.');
    ctx.scale(canvas.width / w, canvas.height / h);
    ctx.translate(bleed, bleed);
    if (input.baseColor) { ctx.fillStyle = input.baseColor; ctx.fillRect(-bleed, -bleed, w, h); }
    if (original) {
      ctx.save();
      ctx.translate(panel.width / 2, panel.height / 2);
      ctx.rotate((panel.sourceRotation ?? 0) * Math.PI / 180);
      ctx.translate(-panel.width / 2, -panel.height / 2);
      // Explicit face artwork replaces the sheet texture in the editor and 3D
      // preview. Transparent or uncovered areas reveal only the base color.
      if (explicit) drawPanelArtwork(ctx, explicit, await getImage(explicit.url), original.width, original.height);
      else for (const layer of visible) {
        const image = await getImage(layer.url);
        const t = sheetTransformToPhysical(layer.transform, source.bounds);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, (layer.opacity ?? 100) / 100));
        ctx.translate(t.centerX - original.x, t.centerY - original.y);
        ctx.rotate(t.rotation * Math.PI / 180);
        ctx.drawImage(image, -t.width / 2, -t.height / 2, t.width, t.height);
        ctx.restore();
      }
      ctx.restore();
    }
    // An actual bleed mask: expand only external cut edges, never the fold edges.
    // Artwork continues in its existing physical coordinates; white/transparent
    // edges are not invented or stretched to manufacture missing bleed.
    const mask = document.createElement('canvas');
    mask.width = canvas.width; mask.height = canvas.height;
    const m = mask.getContext('2d')!;
    m.scale(canvas.width / w, canvas.height / h);
    m.translate(bleed - panel.x, bleed - panel.y);
    m.fillStyle = '#fff';
    m.beginPath();
    panel.outline.forEach((point, i) => i ? m.lineTo(point.x, point.y) : m.moveTo(point.x, point.y));
    m.closePath(); m.fill();
    if (bleed > 0) {
      m.lineWidth = 2 * bleed; m.lineCap = 'round'; m.lineJoin = 'round'; m.strokeStyle = '#fff';
      for (const line of panelCutEdges(panel, geometry.cut)) {
        m.beginPath(); m.moveTo(line.start.x, line.start.y); m.lineTo(line.end.x, line.end.y); m.stroke();
      }
      // Exterior bleed must not repaint another real flap near a re-entrant corner.
      m.globalCompositeOperation = 'destination-out';
      for (const other of geometry.panels) {
        if (other.id === panel.id) continue;
        m.beginPath();
        other.outline.forEach((point, i) => i ? m.lineTo(point.x, point.y) : m.moveTo(point.x, point.y));
        m.closePath(); m.fill();
      }
      m.globalCompositeOperation = 'source-over';
      m.beginPath();
      panel.outline.forEach((point, i) => i ? m.lineTo(point.x, point.y) : m.moveTo(point.x, point.y));
      m.closePath(); m.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    let blob: Blob | null;
    try { blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png')); }
    catch { throw new Error('Artwork could not be embedded due to image permissions. Export without artwork or re-upload the image.'); }
    if (!blob) throw new Error('Could not encode PDF artwork. Export without artwork.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    canvas.width = canvas.height = mask.width = mask.height = 1;
    return { bytes, x: panel.x - bleed, y: panel.y - bleed, width: w, height: h, dpi: pixelsPerMm * 25.4 };
  } };
}

export async function downloadDielinePdf(input: DownloadInput) {
  const { geometry, renderPanel } = preparePdfArtwork(input);
  const result = await createDielinePdf({
    geometry, renderPanel: input.options.includeArtwork ? renderPanel : undefined,
    options: input.options, dimensions: input.dimensions, scope: input.scope,
    title: `3D Box Studio - ${input.templateId} - ${input.scope} - 1:1`,
  });
  const url = URL.createObjectURL(new Blob([result.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `3d-box-studio-${input.templateId}-${input.scope}-1to1.pdf`;
  document.body.append(link);
  link.click(); link.remove();
  // Keep the blob alive long enough for Safari and other delayed download consumers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return result;
}
