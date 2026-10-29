import { createHash } from 'node:crypto';
import { adminPeriodKey, startOfAdminPeriod } from '@/lib/admin-time-zone';
import { ensureV2Schema, getSql } from '@/server/db';

// The error log behind Admin → Errors: what broke on the server and in
// visitors' browsers, counted per problem per day. A problem is its source,
// kind and message with ids and numbers taken out, so the same failure on
// different designs counts as one. Only the first few occurrences each day
// keep their details. No IP address or email address is stored, and
// everything is deleted after RETAIN_DAYS.

export const RETAIN_DAYS = 90;
/** Occurrences kept with their details, per problem per day; all are counted. */
export const SAMPLES_PER_DAY = 20;
/** Different browser problems a day; past this, new ones are counted together, so reports can't fill the table. */
export const CLIENT_PROBLEMS_PER_DAY = 300;
export const OVERFLOW_FINGERPRINT = 'client-overflow';

export type ErrorSource = 'server' | 'client';
export type ErrorReport = {
  source: ErrorSource;
  kind: string;
  message: string;
  path?: string | null;
  userId?: string | null;
  details?: Record<string, unknown>;
};

const EMAIL_RE = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}/gi;
const SECRET_PARAM_RE = /([?&#](?:token|t|code|state|key|secret|password)=)[^&#\s"']+/gi;

/** Takes email addresses and secrets in links out of text that is stored. */
export function redact(text: string): string {
  return text.replace(EMAIL_RE, '[email]').replace(SECRET_PARAM_RE, '$1[redacted]');
}

const clip = (value: string, max: number) => value.length > max ? `${value.slice(0, max - 1)}…` : value;

export function cleanMessage(message: unknown): string {
  const text = typeof message === 'string' ? message : message instanceof Error ? message.message : String(message ?? '');
  return clip(redact(text.replace(/\s+/g, ' ').trim()), 500) || 'No message';
}

/** The path alone: no query or fragment, where tokens and searches live. */
export function cleanPath(path: unknown): string | null {
  if (typeof path !== 'string' || !path.startsWith('/')) return null;
  return clip(path.split(/[?#]/)[0], 300);
}

export function cleanDetails(details: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!details || typeof details !== 'object') return out;
  for (const [key, value] of Object.entries(details).slice(0, 12)) {
    if (value === null || value === undefined || !/^[A-Za-z0-9_]{1,40}$/.test(key)) continue;
    if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
    else out[key] = clip(redact(typeof value === 'string' ? value : JSON.stringify(value) ?? ''), key === 'stack' ? 2000 : 500);
  }
  return out;
}

/** The same failure on another design, size or line counts as the same problem. */
export function fingerprint(source: string, kind: string, message: string): string {
  const shape = message.toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
    .replace(/\b[0-9a-z_-]*\d[0-9a-z_-]{7,}\b/g, '<id>')
    .replace(/\d+(\.\d+)?/g, '#');
  return createHash('sha256').update(`${source}\0${kind}\0${shape}`).digest('hex').slice(0, 24);
}

export const adminDayKey = (now: Date) => adminPeriodKey(startOfAdminPeriod(now, 'day'), 'day');

const RECORD_SQL = `WITH counted AS (
  INSERT INTO error_daily (day, fingerprint, source, kind, message, path, count, first_at, last_at)
  VALUES ($1::date, $2, $3, $4, $5, $6, 1, $9::timestamptz, $9::timestamptz)
  ON CONFLICT (day, fingerprint) DO UPDATE SET count = error_daily.count + 1, last_at = GREATEST(error_daily.last_at, EXCLUDED.last_at)
  RETURNING count
)
INSERT INTO error_samples (day, fingerprint, occurred_at, path, user_id, details)
SELECT $1::date, $2, $9::timestamptz, $6, $7, $8::jsonb FROM counted WHERE count <= ${SAMPLES_PER_DAY}`;

/** Records one error. Never throws: logging a failure must not cause another. */
export async function recordError(report: ErrorReport, now = new Date()): Promise<void> {
  try {
    await ensureV2Schema();
    const sql = getSql();
    const day = adminDayKey(now);
    const kind = clip(report.kind.replace(/[^\w .:/-]/g, '').trim() || 'error', 60);
    let message = cleanMessage(report.message);
    let print = fingerprint(report.source, kind, message);
    if (report.source === 'client') {
      const [row] = await sql.query(
        `SELECT COUNT(*)::int AS problems, BOOL_OR(fingerprint = $2) AS known FROM error_daily WHERE day = $1::date AND source = 'client'`,
        [day, print],
      ) as { problems: number; known: boolean | null }[];
      if (!row?.known && (row?.problems ?? 0) >= CLIENT_PROBLEMS_PER_DAY) {
        print = OVERFLOW_FINGERPRINT;
        message = `More than ${CLIENT_PROBLEMS_PER_DAY} different browser errors today; the rest are counted here.`;
      }
    }
    await sql.query(RECORD_SQL, [day, print, report.source, kind, message, cleanPath(report.path), report.userId ?? null, JSON.stringify(cleanDetails(report.details)), now.toISOString()]);
    if (Math.random() < 0.02) await purgeOldErrors(now);
  } catch (error) {
    console.error('[error-log] could not record an error', error instanceof Error ? error.message : error);
  }
}

export async function purgeOldErrors(now = new Date()): Promise<void> {
  const sql = getSql();
  const cutoff = adminDayKey(new Date(now.getTime() - RETAIN_DAYS * 86_400_000));
  await sql.query(`DELETE FROM error_samples WHERE day < $1::date`, [cutoff]);
  await sql.query(`DELETE FROM error_daily WHERE day < $1::date`, [cutoff]);
}

/** For server code: the error's message, name and the top of its stack. */
export function serverErrorReport(kind: string, error: unknown, extra: { path?: string | null; userId?: string | null; details?: Record<string, unknown> } = {}): ErrorReport {
  const err = error instanceof Error ? error : null;
  return {
    source: 'server',
    kind,
    message: err ? err.message : String(error),
    path: extra.path,
    userId: extra.userId,
    details: {
      ...(err ? { name: err.name } : {}),
      ...(err && 'digest' in err && typeof err.digest === 'string' ? { digest: err.digest } : {}),
      ...extra.details,
      ...(err?.stack ? { stack: err.stack.split('\n').slice(0, 8).join('\n') } : {}),
    },
  };
}
