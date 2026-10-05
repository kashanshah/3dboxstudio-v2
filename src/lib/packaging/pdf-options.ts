export type DielinePdfOptions = {
  bleedMm: number;
  includeArtwork: boolean;
  includeCutCrease: boolean;
  includeCalibration: boolean;
};

export const DEFAULT_DIELINE_PDF_OPTIONS: DielinePdfOptions = {
  bleedMm: 3,
  includeArtwork: true,
  includeCutCrease: true,
  includeCalibration: true,
};

/** An error whose message is already written for the person exporting. */
export class PdfExportError extends Error {
  constructor(message: string) { super(message); this.name = 'PdfExportError'; }
}

export function validatePdfOptions(options: DielinePdfOptions) {
  if (!Number.isFinite(options.bleedMm) || options.bleedMm < 0 || options.bleedMm > 10) {
    throw new PdfExportError('Bleed must be between 0 and 10 mm.');
  }
  if (!options.includeArtwork && !options.includeCutCrease) {
    throw new PdfExportError('Include artwork or cut and crease lines in the PDF.');
  }
}

export function validatePdfDimensions(dimensions: { width: number; height: number; depth: number; thickness: number }) {
  if (![dimensions.width, dimensions.height, dimensions.depth].every(value => Number.isFinite(value) && value >= 1)
    || !Number.isFinite(dimensions.thickness) || dimensions.thickness <= 0) {
    throw new PdfExportError('Enter valid box dimensions of at least 1 mm and a positive board thickness before exporting.');
  }
}

export type ExportDeviceInfo = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  /** navigator.deviceMemory in GiB (Chromium only; rounded, capped at 8). */
  deviceMemory?: number;
};

export function readExportDeviceInfo(): ExportDeviceInfo {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { userAgent: nav.userAgent, platform: nav.platform, maxTouchPoints: nav.maxTouchPoints, deviceMemory: nav.deviceMemory };
}

export function isIOSDevice(info: ExportDeviceInfo) {
  const ua = info.userAgent ?? '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports a Mac user agent and platform; only touch support tells it apart.
  return (info.platform === 'MacIntel' || /Macintosh/.test(ua)) && (info.maxTouchPoints ?? 0) > 1;
}

/** iOS in-app browsers (WKWebView) omit the Safari token and often ignore `a.download`. */
export function isIOSWebView(info: ExportDeviceInfo) {
  return isIOSDevice(info) && !/Safari\//.test(info.userAgent ?? '');
}

export type PdfRasterBudget = {
  tier: 'desktop' | 'mobile' | 'low-memory';
  /** Preferred artwork resolution. */
  targetDpi: number;
  /** The shared total budget never lowers a panel below this; only the per-panel hard cap can. */
  minDpi: number;
  /** Hard cap for one panel canvas in pixels; bounds peak canvas memory. */
  maxPanelPixels: number;
  /** Cap on all rasterized panels together; bounds retained image data and export time. */
  maxTotalPixels: number;
  /** Longest canvas side in pixels. */
  maxSide: number;
};

const MP = 1_000_000;

export function getPdfRasterBudget(info: ExportDeviceInfo = {}): PdfRasterBudget {
  const base = { targetDpi: 300, minDpi: 150, maxSide: 4096 };
  const memory = info.deviceMemory;
  if (typeof memory === 'number' && Number.isFinite(memory) && memory > 0 && memory <= 2) {
    return { ...base, tier: 'low-memory', maxPanelPixels: 2.5 * MP, maxTotalPixels: 16 * MP };
  }
  if (isIOSDevice(info) || /Android|Mobi/i.test(info.userAgent ?? '')) {
    return { ...base, tier: 'mobile', maxPanelPixels: 4 * MP, maxTotalPixels: 32 * MP };
  }
  return { ...base, tier: 'desktop', maxPanelPixels: 16 * MP, maxTotalPixels: Infinity };
}

/**
 * Pixels per millimetre for one panel whose size (including bleed) is given in mm.
 * `totalAreaMm2` is the summed area of every panel that may be rasterized.
 */
export function panelPixelsPerMm(widthMm: number, heightMm: number, totalAreaMm2: number, budget: PdfRasterBudget) {
  const area = Math.max(1e-6, widthMm * heightMm);
  const shared = Math.max(budget.minDpi / 25.4, Math.sqrt(budget.maxTotalPixels / Math.max(area, totalAreaMm2)));
  return Math.min(
    budget.targetDpi / 25.4,
    budget.maxSide / Math.max(widthMm, heightMm, 1e-6),
    Math.sqrt(budget.maxPanelPixels / area),
    shared,
  );
}

export type PanelImageEncoding = 'jpeg' | 'jpeg+smask' | 'png';

/**
 * JPEG avoids pdf-lib's slow in-JS PNG decode and alpha split. Transparency is
 * carried as a separate Flate soft mask; PNG remains only when the browser
 * cannot encode JPEG.
 */
export function choosePanelImageEncoding({ hasAlpha, jpegSupported }: { hasAlpha: boolean; jpegSupported: boolean }): PanelImageEncoding {
  if (!jpegSupported) return 'png';
  return hasAlpha ? 'jpeg+smask' : 'jpeg';
}

/** Turns low-level browser failures (memory, canvas limits) into a readable message. */
export function friendlyPdfError(error: unknown): Error {
  if (error instanceof PdfExportError) return error;
  const name = (error as { name?: string } | null)?.name ?? '';
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (name === 'RangeError' || name === 'QuotaExceededError' || /out of memory|allocat|array buffer|invalid array length/i.test(message)) {
    return new PdfExportError('This device ran out of memory while preparing the PDF. Try exporting without artwork, reduce the box size, or use a desktop browser.');
  }
  if (name === 'SecurityError') {
    return new PdfExportError('Artwork could not be embedded due to image permissions. Export without artwork or re-upload the image.');
  }
  if (error instanceof Error && message) return error;
  return new PdfExportError('Could not prepare the PDF. Please retry.');
}
