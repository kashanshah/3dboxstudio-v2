// Shared by the application and the operator-only migration command.
export const LEGACY_SYNC_SCHEMA = `
CREATE TABLE IF NOT EXISTS admin_deleted_entities (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(kind,id)
);
CREATE TABLE IF NOT EXISTS legacy_records (
  source TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY(source,entity_type,source_id)
);
CREATE INDEX IF NOT EXISTS idx_legacy_records_type ON legacy_records(entity_type) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS legacy_sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  counts JSONB NOT NULL
);`;
