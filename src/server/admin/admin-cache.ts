import { ensureV2Schema, getSql } from '@/server/db';

// A small cache in the database for figures that are slow to work out and
// the same for every server instance. A read or write failure only means
// working the figure out again.

export async function readAdminCache<T>(key: string): Promise<T | null> {
  try {
    await ensureV2Schema();
    const rows = await getSql().query('SELECT value FROM admin_cache WHERE key=$1 AND expires_at>NOW()', [key]) as { value: T }[];
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function writeAdminCache(key: string, value: unknown, ttlMs: number): Promise<void> {
  try {
    await ensureV2Schema();
    await getSql().query(`
      INSERT INTO admin_cache(key, value, expires_at) VALUES($1, $2::jsonb, NOW() + ($3::text || ' milliseconds')::interval)
      ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, expires_at=EXCLUDED.expires_at
    `, [key, JSON.stringify(value), String(Math.round(ttlMs))]);
  } catch {
    // The figure is still returned; the next request works it out again.
  }
}
