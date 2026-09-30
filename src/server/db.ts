import { neon } from '@neondatabase/serverless';
import { requireEnv } from './env';

let sql: ReturnType<typeof neon> | null = null;
let schemaPromise: Promise<void> | null = null;

export function getSql() {
  if (!sql) sql = neon(requireEnv('DATABASE_URL'));
  return sql;
}

export async function ensureV2Schema(): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const db = getSql();
    await db`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await db`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL DEFAULT 'contact_message',
        source TEXT NOT NULL DEFAULT 'website_contact_form',
        status TEXT NOT NULL DEFAULT 'new',
        email TEXT NOT NULL,
        name TEXT,
        topic TEXT,
        subject TEXT,
        message TEXT,
        locale TEXT,
        page_path TEXT,
        referrer TEXT,
        ip_address TEXT,
        user_agent TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions (created_at DESC)`;
    await db`CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions (status)`;
    await db`CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions (email)`;
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}
