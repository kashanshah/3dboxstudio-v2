import { createHmac, timingSafeEqual } from 'node:crypto';
import { ensureV2Schema, getSql } from '@/server/db';
import { hashPassword, verifyPassword } from '@/server/auth/password';

// Client share links (Pro, behind the clientShares flag): a share can show
// the owner's name and logo instead of 3D Box Studio's, and can ask for a
// password. Setting these needs the flag; once set they are always honoured,
// so switching the flag off never opens a password-protected share.
//
// A visitor who enters the password gets a cookie derived from the share id
// and its password hash: changing or removing the password ends every
// unlocked visit, and no other secret is needed.

export const SHARE_ID_RE = /^[0-9A-Za-z]{10,24}$/;
import { BRAND_NAME_MAX, SHARE_PASSWORD_MAX, SHARE_PASSWORD_MIN } from '@/lib/share-brand';
export { BRAND_NAME_MAX, SHARE_PASSWORD_MAX, SHARE_PASSWORD_MIN };
const UNLOCK_DAYS = 30;

export type { ShareBrand } from '@/lib/share-brand';
import type { ShareBrand } from '@/lib/share-brand';
export type ShareSettings = { brandName: string | null; logoAssetId: string | null; hasPassword: boolean };

export const unlockCookieName = (shareId: string) => `share_unlock_${shareId}`;
export const unlockCookieMaxAge = UNLOCK_DAYS * 24 * 60 * 60;
export function unlockCookieValue(shareId: string, passwordHash: string) {
  return createHmac('sha256', passwordHash).update(`share-unlock:${shareId}`).digest('base64url');
}
/** Whether a visitor's cookie unlocks the share. A share without a password is always open. */
export function isShareUnlocked(shareId: string, passwordHash: string | null, cookie: string | undefined) {
  if (!passwordHash) return true;
  if (!cookie) return false;
  const expected = Buffer.from(unlockCookieValue(shareId, passwordHash));
  const given = Buffer.from(cookie);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The brand to show on a share, or null to show 3D Box Studio's. */
export function shareBrand(shareId: string, row: { brand_name: string | null; brand_logo_asset_id: string | null }): ShareBrand | null {
  if (!row.brand_name && !row.brand_logo_asset_id) return null;
  return {
    name: row.brand_name,
    logoUrl: row.brand_logo_asset_id ? `/api/shares/${encodeURIComponent(shareId)}/media/${encodeURIComponent(row.brand_logo_asset_id)}` : null,
  };
}

export type SettingsInput = { brandName?: unknown; logoAssetId?: unknown; password?: unknown };
type Parsed = { brandName: string | null; logoAssetId: string | null; password: string | null | undefined };

/** Checks the owner's changes; password undefined keeps it, null or '' removes it. */
export function parseShareSettings(input: SettingsInput): { ok: true; value: Parsed } | { ok: false; error: string } {
  const brandName = typeof input.brandName === 'string' ? input.brandName.replace(/\s+/g, ' ').trim() : '';
  if (brandName.length > BRAND_NAME_MAX) return { ok: false, error: `Keep the name under ${BRAND_NAME_MAX} characters.` };
  const logoAssetId = typeof input.logoAssetId === 'string' && input.logoAssetId ? input.logoAssetId : null;
  if (logoAssetId && !/^[A-Za-z0-9-]{1,64}$/.test(logoAssetId)) return { ok: false, error: 'Choose a logo from your images.' };
  let password: string | null | undefined;
  if (input.password === undefined) password = undefined;
  else if (input.password === null || input.password === '') password = null;
  else if (typeof input.password !== 'string') return { ok: false, error: 'Enter a password.' };
  else if (input.password.length < SHARE_PASSWORD_MIN || input.password.length > SHARE_PASSWORD_MAX) return { ok: false, error: `Use a password of ${SHARE_PASSWORD_MIN} to ${SHARE_PASSWORD_MAX} characters.` };
  else password = input.password;
  return { ok: true, value: { brandName: brandName || null, logoAssetId, password } };
}

export async function getShareSettings(userId: string, shareId: string): Promise<ShareSettings | null> {
  if (!SHARE_ID_RE.test(shareId)) return null;
  await ensureV2Schema();
  const [row] = await getSql()`
    SELECT brand_name, brand_logo_asset_id, password_hash FROM design_shares
    WHERE id=${shareId} AND user_id=${userId} AND revoked_at IS NULL LIMIT 1
  ` as { brand_name: string | null; brand_logo_asset_id: string | null; password_hash: string | null }[];
  return row ? { brandName: row.brand_name, logoAssetId: row.brand_logo_asset_id, hasPassword: Boolean(row.password_hash) } : null;
}

export class ShareSettingsError extends Error {}

export async function updateShareSettings(userId: string, shareId: string, value: Parsed): Promise<ShareSettings | null> {
  if (!SHARE_ID_RE.test(shareId)) return null;
  await ensureV2Schema();
  const sql = getSql();
  const owned = await sql`SELECT 1 FROM design_shares WHERE id=${shareId} AND user_id=${userId} AND revoked_at IS NULL LIMIT 1` as unknown[];
  if (!owned.length) return null;
  if (value.logoAssetId) {
    const [asset] = await sql`SELECT mime_type FROM media_assets WHERE id=${value.logoAssetId} AND user_id=${userId} LIMIT 1` as { mime_type: string }[];
    if (!asset || !asset.mime_type.startsWith('image/')) throw new ShareSettingsError('Choose a logo from your images.');
  }
  const passwordHash = typeof value.password === 'string' ? await hashPassword(value.password) : null;
  const [row] = await sql`
    UPDATE design_shares SET brand_name=${value.brandName}, brand_logo_asset_id=${value.logoAssetId},
      password_hash=CASE WHEN ${value.password === undefined} THEN password_hash ELSE ${passwordHash} END, updated_at=NOW()
    WHERE id=${shareId} AND user_id=${userId} AND revoked_at IS NULL
    RETURNING brand_name, brand_logo_asset_id, password_hash
  ` as { brand_name: string | null; brand_logo_asset_id: string | null; password_hash: string | null }[];
  return row ? { brandName: row.brand_name, logoAssetId: row.brand_logo_asset_id, hasPassword: Boolean(row.password_hash) } : null;
}

/** The cookie value that unlocks the share, or null for a wrong password or an unknown share. */
export async function unlockShare(shareId: string, password: string): Promise<string | null> {
  if (!SHARE_ID_RE.test(shareId) || password.length > SHARE_PASSWORD_MAX) return null;
  await ensureV2Schema();
  const [row] = await getSql()`
    SELECT password_hash FROM design_shares
    WHERE id=${shareId} AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1
  ` as { password_hash: string | null }[];
  if (!row?.password_hash || !await verifyPassword(password, row.password_hash)) return null;
  return unlockCookieValue(shareId, row.password_hash);
}
