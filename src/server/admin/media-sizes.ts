import { getSql } from '@/server/db';
import { isCatalogMediaKey } from '@/lib/admin-media';
import { headStoredObject } from '@/server/media-assets';

// Persist metadata across server instances and deployments. Failed lookups are
// cached for an hour too, so missing files don't generate repeated S3 requests.
export async function resolveMediaSizes(keys: string[]): Promise<Map<string, number | null>> {
  const unique = [...new Set(keys.filter(isCatalogMediaKey))];
  const sizes = new Map<string, number | null>();
  if (!unique.length) return sizes;
  const sql = getSql();
  const cached = await sql.query(`
    SELECT storage_key, byte_size FROM admin_media_sizes
    WHERE storage_key = ANY($1::text[])
      AND checked_at > NOW() - CASE WHEN byte_size IS NULL THEN INTERVAL '1 hour' ELSE INTERVAL '1 day' END
  `, [unique]) as { storage_key: string; byte_size: number | string | null }[];
  for (const row of cached) sizes.set(row.storage_key, row.byte_size == null ? null : Number(row.byte_size));
  const missing = unique.filter((key) => !sizes.has(key));
  // Limit concurrency and inspect only the files on the current page.
  for (let index = 0; index < missing.length; index += 4) {
    await Promise.all(missing.slice(index, index + 4).map(async (key) => {
      let size: number | null = null;
      try {
        const metadata = await headStoredObject(key, AbortSignal.timeout(5000));
        if (Number.isSafeInteger(metadata.byteSize) && metadata.byteSize >= 0) size = metadata.byteSize;
      } catch { /* Keep browsing working when an object is missing or inaccessible. */ }
      sizes.set(key, size);
      await sql.query(`
        INSERT INTO admin_media_sizes(storage_key, byte_size, checked_at) VALUES ($1, $2, NOW())
        ON CONFLICT (storage_key) DO UPDATE SET byte_size=EXCLUDED.byte_size, checked_at=EXCLUDED.checked_at
      `, [key, size]);
    }));
  }
  return sizes;
}
