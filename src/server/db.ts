import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { requireEnv } from './env';
import { LEGACY_SYNC_SCHEMA } from './legacy-schema';

let sql: ReturnType<typeof neon> | null = null;
let schemaPromise: Promise<void> | null = null;

export function getSql() {
  if (!sql) sql = neon(requireEnv('DATABASE_URL'));
  return sql;
}

const V2_SCHEMA = [
  `
    CREATE TABLE IF NOT EXISTS export_feedback (
      id UUID PRIMARY KEY,
      user_id TEXT,
      edit_key_hash TEXT NOT NULL,
      rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      export_format TEXT NOT NULL,
      template_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_export_feedback_created ON export_feedback(created_at DESC)`,
  `
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
  `,
  `
    CREATE TABLE IF NOT EXISTS oauth_accounts (
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(provider,provider_account_id)
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id)`,
  `
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
  `
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      studio_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      preview_image_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1`,
  `CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_projects_user_favorite ON projects(user_id,is_favorite,updated_at DESC)`,

  `
    CREATE TABLE IF NOT EXISTS workspace_projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_workspace_projects_user_updated ON workspace_projects(user_id,updated_at DESC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_projects_one_default ON workspace_projects(user_id) WHERE is_default=TRUE`,
  `
    INSERT INTO workspace_projects(id,user_id,name,is_default)
    SELECT 'default_' || substr(md5(u.id),1,24), u.id, 'My Project', TRUE
    FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM workspace_projects wp WHERE wp.user_id=u.id AND wp.is_default=TRUE
    )
    ON CONFLICT DO NOTHING
  `,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_project_id TEXT REFERENCES workspace_projects(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_projects_workspace_project ON projects(user_id,workspace_project_id,updated_at DESC)`,
  `
    UPDATE projects p
    SET workspace_project_id=wp.id
    FROM workspace_projects wp
    WHERE p.workspace_project_id IS NULL
      AND wp.user_id=p.user_id
      AND wp.is_default=TRUE
  `,
  `
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
  `,
  `CREATE INDEX IF NOT EXISTS idx_scenes_workspace_project ON scenes(user_id,workspace_project_id,updated_at DESC)`,
  `
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
  `,
  `ALTER TABLE design_shares ALTER COLUMN user_id DROP NOT NULL`,
  `ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS preview_token TEXT`,
  `ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS legacy_assets JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS legacy_source BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_design_shares_preview_token ON design_shares(preview_token) WHERE preview_token IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_design_shares_project_active ON design_shares(project_id) WHERE project_id IS NOT NULL AND revoked_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_design_shares_user_updated ON design_shares(user_id,updated_at DESC)`,
  // Migrated V1 shares were inserted with user_id NULL when the owner was not
  // yet a V2 user. Attribute them to the owning V2 user (V1 user ids are kept
  // as users.id) so owners can manage/revoke them through the V2 share API.
  `
    UPDATE design_shares ds
    SET user_id=u.id
    FROM legacy_records lr
    JOIN users u ON u.id=lr.payload->>'user_id'
    WHERE ds.user_id IS NULL
      AND ds.legacy_source=TRUE
      AND lr.entity_type='shared_designs'
      AND (lr.source_id=ds.id OR (ds.preview_token IS NOT NULL AND lr.payload->>'preview_token'=ds.preview_token))
  `,
  `
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
  `,
  `CREATE INDEX IF NOT EXISTS idx_media_assets_user_created ON media_assets(user_id,created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_media_assets_user_fingerprint ON media_assets(user_id,fingerprint)`,
  `
    CREATE TABLE IF NOT EXISTS admin_media_sizes (
      storage_key TEXT PRIMARY KEY,
      byte_size BIGINT,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS legacy_migrations (
      source TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY(source,entity_type,source_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS admin_deletion_files (
      job_id TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(job_id,storage_key)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
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
  `,
  `CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions (status)`,
  `CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions (email)`,
  `CREATE TABLE IF NOT EXISTS app_schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];

// Every statement is idempotent, so concurrent cold starts may both run them.
// The fingerprint is written only after all of them succeed.
const SCHEMA_STATEMENTS = [...LEGACY_SYNC_SCHEMA.split(';').filter(part => part.trim()), ...V2_SCHEMA];
const SCHEMA_KEY = 'v2_schema';
export const SCHEMA_FINGERPRINT = createHash('sha256').update(SCHEMA_STATEMENTS.join('\0')).digest('hex');

async function appliedFingerprint(db: ReturnType<typeof getSql>): Promise<string | null> {
  try {
    const rows = await db.query('SELECT value FROM app_schema_meta WHERE key=$1', [SCHEMA_KEY]) as { value: string }[];
    return rows[0]?.value ?? null;
  } catch (error) {
    // undefined_table: a database this version has never migrated.
    if ((error as { code?: string })?.code === '42P01') return null;
    throw error;
  }
}

// Runs the DDL only when this deploy's schema differs from the one last
// applied, so a migrated database costs each cold instance a single query.
export async function ensureV2Schema(): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const db = getSql();
    if (await appliedFingerprint(db) === SCHEMA_FINGERPRINT) return;
    for (const statement of SCHEMA_STATEMENTS) await db.query(statement);
    await db.query(
      'INSERT INTO app_schema_meta(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',
      [SCHEMA_KEY, SCHEMA_FINGERPRINT],
    );
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}
