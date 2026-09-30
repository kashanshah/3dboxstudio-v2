import { neon } from '@neondatabase/serverless';
import { requireEnv } from './env';
import { LEGACY_SYNC_SCHEMA } from './legacy-schema';

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
    for (const statement of LEGACY_SYNC_SCHEMA.split(';').filter(part => part.trim())) await db.query(statement);
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
    await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE`;
    await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1`;
    await db`CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id,updated_at DESC)`;
    await db`CREATE INDEX IF NOT EXISTS idx_projects_user_favorite ON projects(user_id,is_favorite,updated_at DESC)`;

    await db`
      CREATE TABLE IF NOT EXISTS workspace_projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_workspace_projects_user_updated ON workspace_projects(user_id,updated_at DESC)`;
    await db`CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_projects_one_default ON workspace_projects(user_id) WHERE is_default=TRUE`;
    await db`
      INSERT INTO workspace_projects(id,user_id,name,is_default)
      SELECT 'default_' || substr(md5(u.id),1,24), u.id, 'My Project', TRUE
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM workspace_projects wp WHERE wp.user_id=u.id AND wp.is_default=TRUE
      )
    `;
    await db`ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_project_id TEXT REFERENCES workspace_projects(id) ON DELETE SET NULL`;
    await db`CREATE INDEX IF NOT EXISTS idx_projects_workspace_project ON projects(user_id,workspace_project_id,updated_at DESC)`;
    await db`
      UPDATE projects p
      SET workspace_project_id=wp.id
      FROM workspace_projects wp
      WHERE p.workspace_project_id IS NULL
        AND wp.user_id=p.user_id
        AND wp.is_default=TRUE
    `;
    await db`
      CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_project_id TEXT NOT NULL REFERENCES workspace_projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        scene_state JSONB NOT NULL DEFAULT '{}'::jsonb,
        preview_image_key TEXT,
        is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_scenes_workspace_project ON scenes(user_id,workspace_project_id,updated_at DESC)`;
    await db`
      CREATE TABLE IF NOT EXISTS design_shares (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        studio_state JSONB NOT NULL,
        preview_token TEXT,
        legacy_assets JSONB NOT NULL DEFAULT '{}'::jsonb,
        legacy_source BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        view_count BIGINT NOT NULL DEFAULT 0
      )
    `;
    await db`ALTER TABLE design_shares ALTER COLUMN user_id DROP NOT NULL`;
    await db`ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS preview_token TEXT`;
    await db`ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS legacy_assets JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await db`ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS legacy_source BOOLEAN NOT NULL DEFAULT FALSE`;
    await db`ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`;
    await db`CREATE UNIQUE INDEX IF NOT EXISTS idx_design_shares_preview_token ON design_shares(preview_token) WHERE preview_token IS NOT NULL`;
    await db`CREATE UNIQUE INDEX IF NOT EXISTS idx_design_shares_project_active ON design_shares(project_id) WHERE project_id IS NOT NULL AND revoked_at IS NULL`;
    await db`CREATE INDEX IF NOT EXISTS idx_design_shares_user_updated ON design_shares(user_id,updated_at DESC)`;
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
