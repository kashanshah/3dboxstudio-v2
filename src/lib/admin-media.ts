export type AdminMediaDesign = { id: string; name: string; href: string };
export type AdminMediaUser = { id: string; name: string; href: string };
export type AdminMediaItem = {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number | null;
  createdAt: string | null;
  previewUrl: string;
  user: AdminMediaUser | null;
  designs: AdminMediaDesign[];
};

const KEY_PATTERN = /^(?:shares|v2)\/[^\u0000]{1,900}$/;

export function formatMediaSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${Number(value.toFixed(2))} ${units[unit]}`;
}

export function isCatalogMediaKey(key: string): boolean {
  return KEY_PATTERN.test(key) && !key.includes('..') && !key.includes('\\');
}

export function mediaFileId(storageKey: string): string {
  return Buffer.from(storageKey, 'utf8').toString('base64url');
}

export function storageKeyFromMediaFileId(id: string): string | null {
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const key = Buffer.from(id, 'base64url').toString('utf8');
  return isCatalogMediaKey(key) ? key : null;
}

export function adminUserHref(id: string): string {
  return `/admin/users/${encodeURIComponent(id)}`;
}

export function adminDesignHref(id: string): string {
  return `/admin/designs/${encodeURIComponent(id)}`;
}

export function adminDesignViewHref(id: string): string {
  return `/admin/designs/${encodeURIComponent(id)}/view`;
}
