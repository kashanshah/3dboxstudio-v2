/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
let db;
const sql = async (strings, ...params) => (await db.query(strings.reduce((query, part, index) => query + part + (index < params.length ? '$' + (index + 1) : ''), ''), params)).rows;
sql.query = async (query, params) => (await db.query(query, params)).rows;
Module._load = function (request, ...args) {
  if (request === '@/server/db' || request === './db') return { ensureV2Schema: async () => {}, getSql: () => sql };
  if (request === '@/server/legacy-media') return { ensureLegacyMediaForDesign: async () => ({}) };
  if (request === '@/server/media-assets') return { headStoredObject: async () => ({ byteSize: 1024 }) };
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);

const { decodeRouteParam } = require('../src/lib/route-params.ts');
const { getWorkspaceDesigns, getStudioProject } = require('../src/server/projects.ts');
const { getDesign } = require('../src/server/admin/catalog.ts');
const { LEGACY_SYNC_SCHEMA } = require('../src/server/legacy-schema.ts');

test('decodeRouteParam normalizes legacy design ids from listing links', () => {
  assert.equal(decodeRouteParam('v1:abc123'), 'v1:abc123');
  assert.equal(decodeRouteParam('v1%3Aabc123'), 'v1:abc123');
  assert.equal(decodeRouteParam('v1%253Aabc123'), 'v1:abc123');
  assert.equal(decodeRouteParam('plain-uuid'), 'plain-uuid');
});

test('opening a listed legacy design works with encoded project query values', async () => {
  db = new PGlite();
  try {
    await db.exec(`CREATE TABLE projects(
      id text primary key, user_id text, name text, studio_state jsonb, preview_image_key text,
      is_favorite boolean default false, revision int default 1, workspace_project_id text, updated_at timestamptz default now()
    );
    CREATE TABLE legacy_records(source text, entity_type text, source_id text, payload jsonb, deleted_at timestamptz, source_hash text);`);
    const now = new Date().toISOString();
    await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload) VALUES('v1','shared_designs','abc123',$1)", [JSON.stringify({
      name: 'Legacy Box', user_id: 'u1', created_at: now, updated_at: now,
      config: { dims: { width: 10, height: 10, length: 10 }, unit: 'cm', materialId: 'kraft', opening: 'closed' },
      images: {},
    })]);

    const listed = await getWorkspaceDesigns('u1');
    assert.equal(listed.total, 1);
    assert.equal(listed.designs[0].id, 'v1:abc123');
    assert.equal(listed.designs[0].href, '/studio/editor?project=v1%3Aabc123');

    const fromListing = await getStudioProject('u1', listed.designs[0].id);
    assert.equal(fromListing?.id, 'v1:abc123');

    const fromEncodedQuery = await getStudioProject('u1', 'v1%3Aabc123');
    assert.equal(fromEncodedQuery?.id, 'v1:abc123');

    const fromDoubleEncoded = await getStudioProject('u1', encodeURIComponent('v1%3Aabc123'));
    assert.equal(fromDoubleEncoded?.id, 'v1:abc123');
  } finally {
    await db.close();
  }
});

test('admin design detail resolves percent-encoded legacy ids from listing links', async () => {
  db = new PGlite();
  try {
    await db.exec(LEGACY_SYNC_SCHEMA);
    await db.exec(`CREATE TABLE users(id text primary key, email text, name text, email_verified_at timestamptz, signup_method text, created_at timestamptz default now());
      CREATE TABLE projects(id text primary key, name text, user_id text, studio_state jsonb, preview_image_key text, created_at timestamptz default now(), updated_at timestamptz default now());
      CREATE TABLE media_assets(id text primary key, user_id text, name text, mime_type text, byte_size bigint, storage_key text, created_at timestamptz default now());
      CREATE TABLE admin_media_sizes(storage_key text primary key, byte_size bigint, checked_at timestamptz default now());
      CREATE TABLE design_shares(id text primary key, project_id text, preview_token text, revoked_at timestamptz, expires_at timestamptz);`);
    const now = new Date().toISOString();
    await db.query("INSERT INTO users(id,email,name,email_verified_at,signup_method) VALUES('u1','ada@example.com','Ada',NOW(),'google')");
    await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash) VALUES('v1','shared_designs',$1,$2,'hash')", ['d1', JSON.stringify({
      name: 'Mailer', user_id: 'u1', created_at: now, updated_at: now, view_count: 4,
      images: { front: { name: 'front.png', mime: 'image/png', s3Key: 'shares/d1/front.png' } },
    })]);

    const encoded = await getDesign('v1%3Ad1');
    assert.equal(encoded?.name, 'Mailer');
    assert.equal(encoded?.legacy, true);
    assert.equal(encoded?.images[0].byteSize, 1024);

    const doubleEncoded = await getDesign(encodeURIComponent('v1%3Ad1'));
    assert.equal(doubleEncoded?.id, 'v1:d1');
  } finally {
    await db.close();
  }
});
