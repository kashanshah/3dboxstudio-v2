/**
 * The error log behind Admin → Errors (src/server/error-log.ts), applied by
 * ensureV2Schema. One row per problem per day (its fingerprint) counts every
 * occurrence; error_samples keeps the first few of each for the details.
 * `day` is the date in the admin's timezone.
 */
export const ERROR_LOG_SCHEMA = [
  `
    CREATE TABLE IF NOT EXISTS error_daily (
      day DATE NOT NULL,
      fingerprint TEXT NOT NULL,
      source TEXT NOT NULL,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      path TEXT,
      count INTEGER NOT NULL DEFAULT 1,
      first_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (day, fingerprint)
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_error_daily_fingerprint ON error_daily (fingerprint, day DESC)`,
  `
    CREATE TABLE IF NOT EXISTS error_samples (
      id BIGSERIAL PRIMARY KEY,
      day DATE NOT NULL,
      fingerprint TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      path TEXT,
      user_id TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `,
  `CREATE INDEX IF NOT EXISTS idx_error_samples_day ON error_samples (day, fingerprint, occurred_at DESC)`,
];
