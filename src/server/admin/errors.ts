import { addAdminPeriod, adminPeriodKey, startOfAdminPeriod } from '@/lib/admin-time-zone';
import { ensureV2Schema, getSql } from '@/server/db';

// Reads for Admin → Errors (the log is written by src/server/error-log.ts).

export const ERROR_DAYS_SHOWN = 14;

export type ErrorDay = { day: string; total: number; problems: number; server: number; client: number };
export type ErrorProblem = {
  fingerprint: string; source: 'server' | 'client'; kind: string; message: string; path: string | null;
  count: number; firstAt: string; lastAt: string; isNew: boolean;
};
export type ErrorSample = { id: string; occurredAt: string; path: string | null; user: { id: string; name: string } | null; details: Record<string, unknown> };
export type ErrorProblemDetail = ErrorProblem & { firstDay: string; history: { day: string; count: number }[]; samples: ErrorSample[]; samplesKept: number };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The day asked for, if it is a real date and not in the future; else today. */
export function parseErrorDay(value: unknown, now = new Date()): string {
  const today = adminPeriodKey(startOfAdminPeriod(now, 'day'), 'day');
  if (typeof value !== 'string' || !DAY_RE.test(value)) return today;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return today;
  return value > today ? today : value;
}

/** The last ERROR_DAYS_SHOWN days up to today, oldest first, with days without errors as zero. */
export async function listErrorDays(now = new Date()): Promise<ErrorDay[]> {
  await ensureV2Schema();
  const end = startOfAdminPeriod(now, 'day');
  const keys = Array.from({ length: ERROR_DAYS_SHOWN }, (_, i) => adminPeriodKey(addAdminPeriod(end, 'day', i - ERROR_DAYS_SHOWN + 1), 'day'));
  const rows = await getSql().query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, SUM(count)::int AS total, COUNT(*)::int AS problems,
       COALESCE(SUM(count) FILTER (WHERE source = 'server'), 0)::int AS server,
       COALESCE(SUM(count) FILTER (WHERE source = 'client'), 0)::int AS client
     FROM error_daily WHERE day >= $1::date GROUP BY day`,
    [keys[0]],
  ) as ErrorDay[];
  const byDay = new Map(rows.map(row => [row.day, row]));
  return keys.map(day => byDay.get(day) ?? { day, total: 0, problems: 0, server: 0, client: 0 });
}

const PROBLEM_COLUMNS = `d.fingerprint, d.source, d.kind, d.message, d.path, d.count, d.first_at AS "firstAt", d.last_at AS "lastAt",
  NOT EXISTS (SELECT 1 FROM error_daily e WHERE e.fingerprint = d.fingerprint AND e.day < d.day) AS "isNew"`;

/** A day's problems, most frequent first. */
export async function listErrorProblems(day: string): Promise<ErrorProblem[]> {
  await ensureV2Schema();
  const rows = await getSql().query(`SELECT ${PROBLEM_COLUMNS} FROM error_daily d WHERE d.day = $1::date ORDER BY d.count DESC, d.last_at DESC LIMIT 500`, [day]) as ErrorProblem[];
  return rows.map(row => ({ ...row, firstAt: new Date(row.firstAt).toISOString(), lastAt: new Date(row.lastAt).toISOString() }));
}

/** One problem on one day: the occurrences kept, and how often it happened on the days before. */
export async function getErrorProblem(day: string, fingerprint: string): Promise<ErrorProblemDetail | null> {
  if (!/^[a-z0-9-]{1,40}$/.test(fingerprint)) return null;
  await ensureV2Schema();
  const sql = getSql();
  const [problem] = await sql.query(`SELECT ${PROBLEM_COLUMNS} FROM error_daily d WHERE d.day = $1::date AND d.fingerprint = $2`, [day, fingerprint]) as ErrorProblem[];
  if (!problem) return null;
  const [history, samples] = await Promise.all([
    sql.query(`SELECT to_char(day, 'YYYY-MM-DD') AS day, count FROM error_daily WHERE fingerprint = $1 ORDER BY day DESC LIMIT 90`, [fingerprint]) as unknown as Promise<{ day: string; count: number }[]>,
    sql.query(
      `SELECT s.id::text AS id, s.occurred_at AS "occurredAt", s.path, s.details, u.id AS user_id, COALESCE(NULLIF(u.name, ''), 'Unnamed account') AS user_name
       FROM error_samples s LEFT JOIN users u ON u.id = s.user_id
       WHERE s.day = $1::date AND s.fingerprint = $2 ORDER BY s.occurred_at DESC`,
      [day, fingerprint],
    ) as unknown as Promise<{ id: string; occurredAt: string; path: string | null; details: Record<string, unknown>; user_id: string | null; user_name: string }[]>,
  ]);
  return {
    ...problem,
    firstAt: new Date(problem.firstAt).toISOString(),
    lastAt: new Date(problem.lastAt).toISOString(),
    firstDay: history.at(-1)?.day ?? day,
    history: history.slice(0, ERROR_DAYS_SHOWN),
    samplesKept: samples.length,
    samples: samples.map(row => ({
      id: row.id, occurredAt: new Date(row.occurredAt).toISOString(), path: row.path, details: row.details ?? {},
      user: row.user_id ? { id: row.user_id, name: row.user_name } : null,
    })),
  };
}
