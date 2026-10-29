/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

// The error log behind Admin → Errors, against a real Postgres (PGlite):
// counting per problem per day, the samples kept, what is redacted, the cap
// on browser problems, retention, and the admin reads.

const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
let db;
const sql = async (strings, ...params) => (await db.query(strings.reduce((query, part, index) => query + part + (index < params.length ? '$' + (index + 1) : ''), ''), params)).rows;
sql.query = async (query, params) => (await db.query(query, params)).rows;
Module._load = function (request, ...args) {
  if (request === '@/server/db') return { ensureV2Schema: async () => {}, getSql: () => sql };
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = require.extensions['.tsx'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);

const log = require('../src/server/error-log.ts');
const admin = require('../src/server/admin/errors.ts');
const { ERROR_LOG_SCHEMA } = require('../src/server/error-log-sql.ts');

async function freshDatabase() {
  db = new PGlite();
  await db.exec(`CREATE TABLE users(id text primary key, email text, name text)`);
  for (const statement of ERROR_LOG_SCHEMA) await db.exec(statement);
  await db.query(`INSERT INTO users(id, email, name) VALUES ('u1', 'ann@example.com', 'Ann')`);
}

// Noon in Toronto (the admin's timezone) on 29 Oct 2026.
const NOON = new Date('2026-10-29T16:00:00Z');
const at = (minutes) => new Date(NOON.getTime() + minutes * 60_000);

test('the same problem is counted together each day, with the first occurrences kept in full', async () => {
  await freshDatabase();
  for (let i = 0; i < log.SAMPLES_PER_DAY + 5; i++) {
    await log.recordError({ source: 'server', kind: 'render', message: `Design ${1000 + i} could not load at line ${i}`, path: `/s/abc${i}?token=secret`, userId: i === 0 ? 'u1' : null, details: { route: '/s/[id]' } }, at(i));
  }
  await log.recordError({ source: 'client', kind: 'uncaught_error', message: 'Cannot read properties of undefined', path: '/studio/editor' }, at(30));
  const problems = await admin.listErrorProblems('2026-10-29');
  assert.equal(problems.length, 2);
  assert.equal(problems[0].count, log.SAMPLES_PER_DAY + 5, 'every occurrence is counted');
  assert.equal(problems[0].isNew, true);
  assert.equal(problems[0].path, '/s/abc0', 'the path is kept without its query');
  const detail = await admin.getErrorProblem('2026-10-29', problems[0].fingerprint);
  assert.equal(detail.samples.length, log.SAMPLES_PER_DAY, 'only the first occurrences keep details');
  assert.deepEqual(detail.samples.at(-1).user, { id: 'u1', name: 'Ann' });
  assert.equal(detail.samples.at(-1).details.route, '/s/[id]');
  const [day] = (await admin.listErrorDays(NOON)).slice(-1);
  assert.deepEqual(day, { day: '2026-10-29', total: log.SAMPLES_PER_DAY + 6, problems: 2, server: log.SAMPLES_PER_DAY + 5, client: 1 });
});

test('days are the admin timezone, and a problem seen before is not new', async () => {
  await freshDatabase();
  // 1 a.m. UTC on the 29th is still the 28th in Toronto.
  await log.recordError({ source: 'server', kind: 'route', message: 'Upload failed' }, new Date('2026-10-29T01:00:00Z'));
  await log.recordError({ source: 'server', kind: 'route', message: 'Upload failed' }, NOON);
  const days = await admin.listErrorDays(NOON);
  assert.equal(days.length, admin.ERROR_DAYS_SHOWN);
  assert.deepEqual(days.slice(-2).map(d => [d.day, d.total]), [['2026-10-28', 1], ['2026-10-29', 1]]);
  assert.equal(days[0].day, '2026-10-16', 'the strip covers two weeks, empty days included');
  const [problem] = await admin.listErrorProblems('2026-10-29');
  assert.equal(problem.isNew, false);
  const detail = await admin.getErrorProblem('2026-10-29', problem.fingerprint);
  assert.equal(detail.firstDay, '2026-10-28');
  assert.deepEqual(detail.history.map(h => h.day), ['2026-10-29', '2026-10-28']);
});

test('email addresses and secrets are never stored', async () => {
  await freshDatabase();
  await log.recordError({ source: 'server', kind: 'email_delivery', message: 'Could not send to ann@example.com', details: { recipient: 'ann@example.com', link: 'https://x.test/reset?token=abc123&x=1', stack: 'Error at https://x.test/a?code=zzz' } }, NOON);
  const stored = JSON.stringify(await sql.query('SELECT * FROM error_daily')) + JSON.stringify(await sql.query('SELECT * FROM error_samples'));
  assert.doesNotMatch(stored, /ann@example\.com|abc123|zzz/);
  assert.match(stored, /\[email\]/);
  assert.match(stored, /token=\[redacted\]/);
});

test('browser reports cannot add endless problems, and old days are deleted', async () => {
  await freshDatabase();
  for (let i = 0; i < log.CLIENT_PROBLEMS_PER_DAY; i++) await db.query(`INSERT INTO error_daily(day, fingerprint, source, kind, message) VALUES ('2026-10-29', $1, 'client', 'uncaught_error', 'x')`, [`f${i}`]);
  await log.recordError({ source: 'client', kind: 'uncaught_error', message: 'Something brand new' }, NOON);
  await log.recordError({ source: 'client', kind: 'uncaught_error', message: 'And another' }, NOON);
  await log.recordError({ source: 'server', kind: 'render', message: 'Server errors are always their own problem' }, NOON);
  const [overflow] = await sql.query(`SELECT count FROM error_daily WHERE fingerprint = $1`, [log.OVERFLOW_FINGERPRINT]);
  assert.equal(overflow.count, 2);
  assert.equal((await sql.query(`SELECT 1 FROM error_daily WHERE source = 'server'`)).length, 1);

  await log.recordError({ source: 'server', kind: 'render', message: 'Old' }, new Date('2026-07-01T16:00:00Z'));
  await log.purgeOldErrors(NOON);
  assert.equal((await sql.query(`SELECT 1 FROM error_daily WHERE day < '2026-08-01'`)).length, 0);
  assert.equal((await sql.query(`SELECT 1 FROM error_samples WHERE day < '2026-08-01'`)).length, 0);
});

test('recording never throws, and the admin day is never in the future', async () => {
  db = { query: async () => { throw new Error('database down'); } };
  const quiet = console.error; console.error = () => {};
  try { await assert.doesNotReject(log.recordError({ source: 'server', kind: 'render', message: 'x' })); } finally { console.error = quiet; }
  assert.equal(admin.parseErrorDay('2026-10-28', NOON), '2026-10-28');
  assert.equal(admin.parseErrorDay('2026-11-02', NOON), '2026-10-29');
  assert.equal(admin.parseErrorDay('2026-02-30', NOON), '2026-10-29');
  assert.equal(admin.parseErrorDay('nonsense', NOON), '2026-10-29');
});
