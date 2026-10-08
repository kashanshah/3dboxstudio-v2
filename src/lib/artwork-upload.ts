// Shared (client + server) rules for artwork uploads: which files we accept,
// how a missing browser MIME type is recovered from the file extension, and
// how per-file failures are summarised for people without technical detail.

export const MAX_ARTWORK_BYTES = 100 * 1024 * 1024;
export const ALLOWED_ARTWORK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;

const EXTENSION_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

const HEIC_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const HEIC_EXTENSIONS = new Set(['heic', 'heif']);

export type ArtworkUploadErrorCode = 'too_large' | 'unsupported_type' | 'heic' | 'empty' | 'rate_limited' | 'failed';

/** Where a browser upload failed: asking our API for an upload URL, sending bytes to storage, or confirming it. */
export type ArtworkUploadStage = 'prepare' | 'storage' | 'finalize';

export class ArtworkUploadError extends Error {
  readonly code: ArtworkUploadErrorCode;
  readonly stage?: ArtworkUploadStage;
  readonly status?: number;
  readonly timedOut?: boolean;
  constructor(message: string, code: ArtworkUploadErrorCode, details: { stage?: ArtworkUploadStage; status?: number; timedOut?: boolean } = {}) {
    super(message);
    this.name = 'ArtworkUploadError';
    this.code = code;
    this.stage = details.stage;
    this.status = details.status;
    this.timedOut = details.timedOut;
  }
}

export const HEIC_UPLOAD_MESSAGE = 'Convert HEIC photos to JPG or PNG first.';

function extensionOf(name: string) {
  const match = /\.([A-Za-z0-9]+)$/.exec(name.trim());
  return match ? match[1].toLowerCase() : '';
}

export function isAllowedArtworkType(mimeType: string) {
  return (ALLOWED_ARTWORK_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Browsers frequently report an empty File.type for SVGs (and occasionally
 * other images, e.g. from some drag sources). Fall back to the extension only
 * when the browser gave us nothing; a non-empty type is kept as-is.
 */
export function inferArtworkMimeType(name: string, type: string | null | undefined): string {
  const reported = (type ?? '').trim().toLowerCase();
  if (reported) return reported === 'image/jpg' ? 'image/jpeg' : reported;
  return EXTENSION_TYPES[extensionOf(name)] ?? '';
}

export function isHeicArtwork(name: string, type: string | null | undefined) {
  return HEIC_TYPES.has((type ?? '').trim().toLowerCase()) || HEIC_EXTENSIONS.has(extensionOf(name));
}

/** Validate a file before upload. Returns the MIME type to send, or a typed error. */
export function checkArtworkFile(file: { name: string; type: string; size: number }):
  { ok: true; mimeType: string } | { ok: false; error: ArtworkUploadError } {
  if (isHeicArtwork(file.name, file.type)) return { ok: false, error: new ArtworkUploadError(HEIC_UPLOAD_MESSAGE, 'heic') };
  const mimeType = inferArtworkMimeType(file.name, file.type);
  if (!isAllowedArtworkType(mimeType)) return { ok: false, error: new ArtworkUploadError('Use PNG, JPG, WebP or SVG artwork.', 'unsupported_type') };
  if (!(file.size > 0)) return { ok: false, error: new ArtworkUploadError('The selected image is empty.', 'empty') };
  if (file.size > MAX_ARTWORK_BYTES) return { ok: false, error: new ArtworkUploadError('Artwork must be 100 MB or smaller.', 'too_large') };
  return { ok: true, mimeType };
}

export function artworkUploadErrorCode(error: unknown): ArtworkUploadErrorCode {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && ['too_large', 'unsupported_type', 'heic', 'empty', 'rate_limited', 'failed'].includes(code)
    ? code as ArtworkUploadErrorCode
    : 'failed';
}

const REASONS: Record<ArtworkUploadErrorCode, string> = {
  too_large: 'too large',
  unsupported_type: 'unsupported type',
  heic: 'HEIC photo',
  empty: 'empty file',
  rate_limited: 'too many uploads, try again in a few minutes',
  failed: 'upload failed',
};

export type ArtworkUploadFailure = { name: string; code: ArtworkUploadErrorCode };

/** Failures worth offering a retry for: network, storage and rate-limit problems, not bad files. */
export function isRetryableArtworkFailure(code: ArtworkUploadErrorCode) {
  return code === 'failed' || code === 'rate_limited';
}

/**
 * One clear status line for a (possibly partial) multi-file upload, e.g.
 * "2 of 5 images uploaded. Couldn't upload: a.png (too large), b.heic (HEIC photo). Convert HEIC photos to JPG or PNG first."
 */
export function summarizeArtworkUpload(total: number, failures: ArtworkUploadFailure[], successMessage: string): string {
  if (!failures.length) return successMessage;
  const succeeded = Math.max(0, total - failures.length);
  const list = failures.map(failure => `${failure.name} (${REASONS[failure.code]})`).join(', ');
  const heicTip = failures.some(failure => failure.code === 'heic') ? ` ${HEIC_UPLOAD_MESSAGE}` : '';
  const head = total === 1
    ? ''
    : `${succeeded} of ${total} images uploaded. `;
  return `${head}Couldn't upload: ${list}.${heicTip}`;
}

/** Insert or refresh assets by id, so a server-returned existing asset never appears twice. */
export function mergeMediaAssets<T extends { id: string; createdAt: number }>(current: T[], added: T[]): T[] {
  const merged = new Map(current.map(asset => [asset.id, asset]));
  for (const asset of added) merged.set(asset.id, asset);
  return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt);
}
