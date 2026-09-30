export type AdminMediaDesign = { id: string; name: string; href: string };
export type AdminMediaUser = { id: string; name: string; href: string };
export type AdminMediaItem = {
  id: string;
  name: string;
  mimeType: string;
  createdAt: string | null;
  previewUrl: string;
  user: AdminMediaUser | null;
  designs: AdminMediaDesign[];
};

const KEY_PATTERN = /^(?:shares|v2)\/[^\u0000]{1,900}$/;

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
