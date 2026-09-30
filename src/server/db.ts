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
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        password_hash TEXT,
        email_verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        signup_method TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        utm_term TEXT,
        utm_content TEXT,
        signup_landing_page TEXT,
        signup_landing_type TEXT,
        signup_conversion_page TEXT,
        signup_referrer TEXT,
        signup_meta JSONB,
        migrated_from TEXT,
        migrated_at TIMESTAMPTZ
      )
    `;
    await db`
      CREATE TABLE IF NOT EXISTS oauth_accounts (
        provider TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(provider,provider_account_id)
      )
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id)`;
    await db`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`;
    await db`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ
      )
    `;
    await db`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ
      )
    `;
    await db`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        studio_state JSONB NOT NULL DEFAULT '{}'::jsonb,
        preview_image_key TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id,updated_at DESC)`;
    await db`
      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        byte_size BIGINT NOT NULL DEFAULT 0,
        width INTEGER,
        height INTEGER,
        storage_key TEXT NOT NULL,
        fingerprint TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id,storage_key)
      )
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_media_assets_user_created ON media_assets(user_id,created_at DESC)`;
    await db`CREATE INDEX IF NOT EXISTS idx_media_assets_user_fingerprint ON media_assets(user_id,fingerprint)`;
    await db`
      CREATE TABLE IF NOT EXISTS legacy_migrations (
        source TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        PRIMARY KEY(source,entity_type,source_id)
      )
    `;
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
