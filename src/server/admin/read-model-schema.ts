// The admin's read model: columns Postgres keeps in step with every save, the
// indexes the admin lists sort and filter by, and tolerant readers for legacy
// payloads. With these, the admin finds a design's images and counts its
// artwork without reading or text-searching the saved editor state, and one
// malformed legacy date cannot break a whole list.
export const ADMIN_READ_MODEL_SCHEMA = [
  // media_refs: every media id a design points at (asset ids and /api/media/ URLs).
  `
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS media_refs JSONB GENERATED ALWAYS AS (
      jsonb_path_query_array(studio_state, 'lax $.**.assetId')
      || jsonb_path_query_array(studio_state, 'lax $.mediaAssets[*].id')
      || jsonb_path_query_array(studio_state, 'lax $.**.url ? (@ starts with "/api/media/")')
    ) STORED
  `,
  `
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS artwork_count INTEGER GENERATED ALWAYS AS (
      jsonb_array_length(jsonb_path_query_array(studio_state, 'lax $.outsideArtworkLayers[*]'))
      + jsonb_array_length(jsonb_path_query_array(studio_state, 'lax $.insideArtworkLayers[*]'))
      + jsonb_array_length(jsonb_path_query_array(studio_state, 'lax $.artworkByPanel.*'))
    ) STORED
  `,
  `CREATE INDEX IF NOT EXISTS idx_projects_media_refs ON projects USING GIN (media_refs)`,
  `CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_media_assets_storage_key ON media_assets(storage_key)`,
  `CREATE INDEX IF NOT EXISTS idx_media_assets_created ON media_assets(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_export_feedback_project ON export_feedback(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_export_feedback_user ON export_feedback(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_legacy_shared_designs_user ON legacy_records((payload->>'user_id')) WHERE entity_type='shared_designs' AND deleted_at IS NULL`,
  // Legacy payloads are copied verbatim; one malformed date must not break a
  // whole admin list, so they are read through these instead of a cast.
  `
    CREATE OR REPLACE FUNCTION admin_ts(value TEXT) RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE AS $$
    BEGIN
      RETURN NULLIF(value, '')::timestamptz;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END $$
  `,
  `
    CREATE OR REPLACE FUNCTION admin_bigint(value TEXT) RETURNS BIGINT LANGUAGE plpgsql IMMUTABLE AS $$
    BEGIN
      RETURN NULLIF(value, '')::bigint;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END $$
  `,
  // Slow external figures (S3 inventory, AWS cost) shared by every server
  // instance, so a cold instance reuses the last result instead of
  // listing the bucket again.
  `CREATE TABLE IF NOT EXISTS admin_cache (key TEXT PRIMARY KEY, value JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`,
];
