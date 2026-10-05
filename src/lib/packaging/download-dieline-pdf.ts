import type { ArtworkByPanel, ArtworkPlacement } from './artwork';
import { sheetTransformToPhysical, type FullDielineArtworkLayer } from './full-dieline-artwork';
import { getTemplateExportGeometry, getTemplateGeometry, type TemplateGeometryOptions } from './template-runtime';
import type { CartonDimensions } from './reverse-tuck';
import {
  validatePdfOptions, validatePdfDimensions, getPdfRasterBudget, panelPixelsPerMm, choosePanelImageEncoding,
  friendlyPdfError, isIOSWebView, readExportDeviceInfo, PdfExportError,
  type DielinePdfOptions, type ExportDeviceInfo, type PdfRasterBudget,
} from './pdf-options';
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
  /** Defaults to the current navigator; overridable for tests. */
  deviceInfo?: ExportDeviceInfo;
  rasterBudget?: PdfRasterBudget;
};

const JPEG_QUALITY = 0.92;
const SVG_MIN_RASTER_SIDE = 2048;

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => image.decode().then(() => resolve(image), () => reject(new PdfExportError('Could not decode artwork. Retry after the image has loaded.')));
    image.onerror = () => reject(new PdfExportError('Could not load artwork for PDF. Retry or export without artwork.'));
    image.src = url;
  });
}

const svgLength = (value: string | null) => {
  const match = value?.trim().match(/^(\d*\.?\d+(?:e[-+]?\d+)?)(px)?$/i);
  const n = match ? Number(match[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Intrinsic raster size for an SVG root lacking usable width/height. Uses the
 * viewBox (and any one absolute dimension), scaled up so vector artwork keeps
 * print detail. Returns null when the SVG gives no size or aspect at all.
 */
export function svgIntrinsicSize(width: string | null, height: string | null, viewBox: string | null) {
  const box = viewBox?.trim().split(/[\s,]+/).map(Number);
  const vb = box && box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0 ? { w: box[2], h: box[3] } : null;
  let w = svgLength(width), h = svgLength(height);
  if (w && !h && vb) h = w * vb.h / vb.w;
  if (h && !w && vb) w = h * vb.w / vb.h;
  if (!w || !h) { if (!vb) return null; w = vb.w; h = vb.h; }
  const scale = Math.max(1, SVG_MIN_RASTER_SIDE / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), viewBox: vb ? null : `0 0 ${w} ${h}` };
}

const NO_SIZE_MESSAGE = 'An SVG artwork has no width, height or viewBox, so it cannot be placed in the PDF. Re-export the SVG with a size and upload it again.';

/** SVGs without intrinsic size report naturalWidth 0 (NaN ratios, blank panels); give them one. */
async function sizedSvgUrl(url: string) {
  let text: string;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    text = await response.text();
  } catch { throw new PdfExportError(NO_SIZE_MESSAGE); }
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  if (svg.nodeName.toLowerCase() !== 'svg') throw new PdfExportError(NO_SIZE_MESSAGE);
  const size = svgIntrinsicSize(svg.getAttribute('width'), svg.getAttribute('height'), svg.getAttribute('viewBox'));
  if (!size) throw new PdfExportError(NO_SIZE_MESSAGE);
  if (size.viewBox) svg.setAttribute('viewBox', size.viewBox);
  svg.setAttribute('width', String(size.width));
  svg.setAttribute('height', String(size.height));
  return URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = await loadImageElement(url);
  if (image.naturalWidth > 0 && image.naturalHeight > 0) return image;
  const sized = await sizedSvgUrl(url);
  try {
    const fixed = await loadImageElement(sized);
    if (fixed.naturalWidth > 0 && fixed.naturalHeight > 0) return fixed;
  } finally { URL.revokeObjectURL(sized); }
  throw new PdfExportError(NO_SIZE_MESSAGE);
}

let jpegSupport: boolean | undefined;
function canEncodeJpeg() {
  if (jpegSupport === undefined) {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    try { jpegSupport = probe.toDataURL('image/jpeg', 0.5).startsWith('data:image/jpeg'); } catch { jpegSupport = false; }
    probe.width = probe.height = 0;
  }
  return jpegSupport;
}

/** Reads alpha in strips so no full-size RGBA copy is held; null when fully opaque. */
function readAlpha(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const alpha = new Uint8Array(width * height);
  let opaque = true;
  const rows = Math.max(1, Math.floor(262_144 / width));
  for (let y = 0; y < height; y += rows) {
    const count = Math.min(rows, height - y);
    const data = ctx.getImageData(0, y, width, count).data;
    for (let i = 0, o = y * width, n = width * count; i < n; i++, o++) {
      const a = data[i * 4 + 3];
      alpha[o] = a;
      if (a !== 255) opaque = false;
    }
  }
  return opaque ? null : alpha;
}

const encodeCanvas = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));

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
  const budget = input.rasterBudget ?? getPdfRasterBudget(input.deviceInfo ?? readExportDeviceInfo());
  const bleed = input.options.bleedMm;
  // The shared pixel budget is spread over every panel that can carry artwork.
  const totalAreaMm2 = geometry.panels
    .filter(panel => input.baseColor || source.panels.some(p => p.id === panel.sourceId))
    .reduce((sum, panel) => sum + (panel.width + 2 * bleed) * (panel.height + 2 * bleed), 0);
  const images = new Map<string, Promise<HTMLImageElement>>();
  const getImage = (url: string) => {
    let image = images.get(url);
    if (!image) { image = loadImage(url); images.set(url, image); }
    return image;
  };
  // One artwork canvas and one mask canvas are reused for every panel and shrunk
  // to zero after each one, so peak canvas memory is a single panel.
  let canvas: HTMLCanvasElement | null = null;
  let mask: HTMLCanvasElement | null = null;
  const release = () => { for (const c of [canvas, mask]) if (c) c.width = c.height = 0; };
  const visible = input.layers.filter(layer => layer.visible !== false && (layer.opacity ?? 100) > 0);
  const renderPanel = async (index: number): Promise<PdfPanelImage | null> => {
    const panel = geometry.panels[index];
    const original = source.panels.find(p => p.id === panel.sourceId);
    const panelName = original?.label.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
    const explicit = panelName ? input.artworkByPanel[input.scope === 'inside' ? `Interior ${panelName}` : panelName] : undefined;
    if (!input.baseColor && (!original || (!visible.length && !explicit))) return null;
    const w = panel.width + 2 * bleed, h = panel.height + 2 * bleed;
    const pixelsPerMm = panelPixelsPerMm(w, h, totalAreaMm2, budget);
    // Load artwork before allocating the canvas.
    const explicitImage = original && explicit ? await getImage(explicit.url) : null;
    const layerImages = original && !explicit ? await Promise.all(visible.map(layer => getImage(layer.url))) : [];
    canvas ??= document.createElement('canvas');
    mask ??= document.createElement('canvas');
    try {
      canvas.width = Math.max(1, Math.round(w * pixelsPerMm));
      canvas.height = Math.max(1, Math.round(h * pixelsPerMm));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new PdfExportError('Canvas is unavailable. Export without artwork.');
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
        if (explicit && explicitImage) drawPanelArtwork(ctx, explicit, explicitImage, original.width, original.height);
        else visible.forEach((layer, i) => {
          const t = sheetTransformToPhysical(layer.transform, source.bounds);
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, (layer.opacity ?? 100) / 100));
          ctx.translate(t.centerX - original.x, t.centerY - original.y);
          ctx.rotate(t.rotation * Math.PI / 180);
          ctx.drawImage(layerImages[i], -t.width / 2, -t.height / 2, t.width, t.height);
          ctx.restore();
        });
        ctx.restore();
      }
      // An actual bleed mask: expand only external cut edges, never the fold edges.
      // Artwork continues in its existing physical coordinates; white/transparent
      // edges are not invented or stretched to manufacture missing bleed.
      mask.width = canvas.width; mask.height = canvas.height;
      const m = mask.getContext('2d');
      if (!m) throw new PdfExportError('Canvas is unavailable. Export without artwork.');
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
      mask.width = mask.height = 0;
      const pixelWidth = canvas.width, pixelHeight = canvas.height;
      let blob: Blob | null;
      let alpha: Uint8Array | null = null;
      let format: 'png' | 'jpeg';
      try {
        const jpegSupported = canEncodeJpeg();
        if (jpegSupported) alpha = readAlpha(ctx, pixelWidth, pixelHeight);
        // 'jpeg' when opaque, 'jpeg+smask' (alpha kept) when not, 'png' only without JPEG support.
        if (choosePanelImageEncoding({ hasAlpha: Boolean(alpha), jpegSupported }) !== 'png') {
          format = 'jpeg';
          // JPEG has no alpha: flatten onto paper white; the soft mask restores transparency.
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, pixelWidth, pixelHeight);
          blob = await encodeCanvas(canvas, 'image/jpeg', JPEG_QUALITY);
        } else {
          format = 'png';
          blob = await encodeCanvas(canvas, 'image/png');
        }
      } catch { throw new PdfExportError('Artwork could not be embedded due to image permissions. Export without artwork or re-upload the image.'); }
      if (!blob) throw new PdfExportError('Could not encode PDF artwork. This device may be low on memory; export without artwork or use a desktop browser.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return {
        bytes, format, alpha, pixelWidth, pixelHeight,
        x: panel.x - bleed, y: panel.y - bleed, width: w, height: h,
        dpi: Math.min(pixelWidth / w, pixelHeight / h) * 25.4,
      };
    } finally { release(); }
  };
  return { geometry, budget, renderPanel, dispose: release };
}

const supportsDownloadAttribute = () => typeof HTMLAnchorElement !== 'undefined' && 'download' in HTMLAnchorElement.prototype;

/**
 * The PDF is ready only after long async work, so the click's user activation
 * has usually expired. Anchor downloads still work in Safari and desktop
 * browsers; iOS in-app webviews ignore `download`, so share or open instead.
 */
async function deliverPdf(bytes: Uint8Array, filename: string, info: ExportDeviceInfo): Promise<'download' | 'share' | 'tab' | 'cancelled'> {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
  if (supportsDownloadAttribute() && !isIOSWebView(info)) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click(); link.remove();
    // Keep the blob alive long enough for Safari and other delayed download consumers.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'download';
  }
  const file = typeof File === 'function' ? new File([blob], filename, { type: 'application/pdf' }) : null;
  if (file && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'share';
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
      // NotAllowedError (expired user activation) and others fall through to a new tab.
    }
  }
  const url = URL.createObjectURL(blob);
  if (window.open(url, '_blank')) { setTimeout(() => URL.revokeObjectURL(url), 300_000); return 'tab'; }
  URL.revokeObjectURL(url);
  throw new PdfExportError('This browser blocked the PDF download. Open 3D Box Studio in Safari or Chrome and try again.');
}

export async function downloadDielinePdf(input: DownloadInput) {
  let dispose: (() => void) | undefined;
  try {
    const deviceInfo = input.deviceInfo ?? readExportDeviceInfo();
    const prepared = preparePdfArtwork({ ...input, deviceInfo });
    dispose = prepared.dispose;
    const result = await createDielinePdf({
      geometry: prepared.geometry, renderPanel: input.options.includeArtwork ? prepared.renderPanel : undefined,
      options: input.options, dimensions: input.dimensions, scope: input.scope,
      title: `3D Box Studio - ${input.templateId} - ${input.scope} - 1:1`,
    });
    dispose();
    const delivery = await deliverPdf(result.bytes, `3d-box-studio-${input.templateId}-${input.scope}-1to1.pdf`, deviceInfo);
    return { ...result, delivery, rasterTier: prepared.budget.tier };
  } catch (error) {
    throw friendlyPdfError(error);
  } finally { dispose?.(); }
}
