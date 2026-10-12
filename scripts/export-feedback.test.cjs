/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

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
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);

const { saveExportRating, listExportFeedback } = require('../src/server/export-feedback.ts');

const KEY = '00000000-0000-4000-8000-000000000000';

test.before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT);
    CREATE TABLE projects(id TEXT PRIMARY KEY, user_id TEXT, name TEXT);
    CREATE TABLE export_feedback(id UUID PRIMARY KEY, user_id TEXT, edit_key_hash TEXT NOT NULL, rating SMALLINT NOT NULL, comment TEXT,
      export_format TEXT NOT NULL, template_id TEXT NOT NULL, project_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    INSERT INTO users VALUES('u1','maker@example.com'),('u2','other@example.com');
    INSERT INTO projects VALUES('p1','u1','Mailer for spring'),('p2','u2','Not theirs');
  `);
});

test('a rating records the design it was given on, for admins to open from the feedback list', async () => {
  await saveExportRating({ rating: 5, format: 'pdf', templateId: 'mailer-box', userId: 'u1', editKey: KEY, projectId: 'p1' });
  const [item] = await listExportFeedback();
  assert.equal(item.projectId, 'p1');
  assert.equal(item.projectName, 'Mailer for spring');
  assert.equal(item.userId, 'u1');
  assert.equal(item.email, 'maker@example.com');
});

test('only a design the signed-in account owns is recorded; guests and unsaved designs record none', async () => {
  await db.exec('DELETE FROM export_feedback');
  await saveExportRating({ rating: 4, format: 'png', templateId: 'pizza-box', userId: 'u1', editKey: KEY, projectId: 'p2' });
  await saveExportRating({ rating: 3, format: 'png', templateId: 'pizza-box', userId: null, editKey: KEY, projectId: 'p1' });
  await saveExportRating({ rating: 2, format: 'mp4', templateId: 'pizza-box', userId: 'u1', editKey: KEY });
  const items = await listExportFeedback();
  assert.equal(items.length, 3);
  assert.ok(items.every(item => item.projectId === null));
});

test('a rating on a design deleted since lists no design but still links its account', async () => {
  await db.exec('DELETE FROM export_feedback');
  await saveExportRating({ rating: 5, format: 'pdf', templateId: 'mailer-box', userId: 'u1', editKey: KEY, projectId: 'p1' });
  await db.exec(`DELETE FROM projects WHERE id='p1'`);
  const [item] = await listExportFeedback();
  assert.equal(item.projectId, null);
  assert.equal(item.userId, 'u1');
});
