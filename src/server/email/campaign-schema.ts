import type { NeonQueryFunction } from '@neondatabase/serverless';
import { getSql, ensureV2Schema } from '@/server/db';

export function campaignSql() { return getSql() as NeonQueryFunction<false, false>; }

export const CAMPAIGN_SCHEMA = `
CREATE TABLE IF NOT EXISTS email_campaigns (
 id TEXT PRIMARY KEY, content JSONB NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL DEFAULT 'draft', broadcast_id TEXT UNIQUE, create_attempted BOOLEAN NOT NULL DEFAULT FALSE,
 scheduled_at TIMESTAMPTZ, time_zone TEXT NOT NULL DEFAULT 'America/Toronto',
 tested_revision INTEGER, test_email_id TEXT, test_recipient TEXT, tested_at TIMESTAMPTZ,
 metrics JSONB NOT NULL DEFAULT '{}', metrics_at TIMESTAMPTZ, last_error TEXT,
 lock_token TEXT, lock_until TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS email_campaign_imports (
 id TEXT PRIMARY KEY, segment_id TEXT NOT NULL, source_filter TEXT NOT NULL,
 recipients JSONB NOT NULL, processed INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'pending', last_error TEXT, lock_token TEXT, lock_until TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS email_campaign_events (
 event_id TEXT PRIMARY KEY, broadcast_id TEXT, email_id TEXT, event_type TEXT NOT NULL,
 recipient TEXT NOT NULL DEFAULT '', link TEXT, occurred_at TIMESTAMPTZ NOT NULL,
 detail JSONB NOT NULL DEFAULT '{}', received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_campaign_events_broadcast ON email_campaign_events(broadcast_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaign_events_email ON email_campaign_events(email_id, occurred_at DESC);
CREATE TABLE IF NOT EXISTS email_campaign_webhook (
 id INTEGER PRIMARY KEY CHECK (id=1), provider_id TEXT NOT NULL, encrypted_secret TEXT NOT NULL,
 endpoint TEXT NOT NULL, last_received_at TIMESTAMPTZ, configured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS email_campaign_segment_locks (
 id TEXT PRIMARY KEY, lock_token TEXT NOT NULL, lock_until TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS email_campaign_audit (
 id TEXT PRIMARY KEY, campaign_id TEXT REFERENCES email_campaigns(id), action TEXT NOT NULL,
 detail JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;
let pending: Promise<void> | null = null;
export async function ensureCampaignSchema() {
  if (!pending) pending = (async () => {
    await ensureV2Schema();
    for (const statement of CAMPAIGN_SCHEMA.split(';').filter(s => s.trim())) await getSql().query(statement);
  })().catch(error => { pending = null; throw error; });
  return pending;
}
