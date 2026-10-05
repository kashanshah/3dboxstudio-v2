/* eslint-disable @typescript-eslint/no-require-imports */
// Legacy (V1) designs: convert-on-save, owner deletion, and legacy share links
// served through V2 design_shares rows (so V2 revocation is authoritative).
// Runs the real ensureV2Schema against an in-memory PGlite database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

const db = new PGlite();
const sql = async (strings, ...params) => (await db.query(strings.reduce((query, part, index) => query + part + (index < params.length ? '$' + (index + 1) : ''), ''), params)).rows;
sql.query = async (query, params) => (await db.query(query, params ?? [])).rows;

let currentUser = { id: 'u1', emailVerified: true };
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
const json = (body, init) => new Response(JSON.stringify(body), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
Module._load = function (request, ...args) {
  if (request === '@neondatabase/serverless') return { neon: () => sql };
  if (request === './env') return { requireEnv: () => 'postgres://pglite', optionalEnv: (_name, fallback) => fallback };
  if (request === 'next/server') return { NextResponse: { json } };
  if (request === '@/server/auth/session') return { getCurrentUser: async () => currentUser };
  if (request === '@/server/auth/action-request') return { guardAuthAction: () => null };
  if (request === '@/lib/posthog-server') return { captureServerEvent: async () => {}, captureServerException: async () => {} };
  if (request === '@/lib/posthog-logs') return { emitPostHogLog: () => {} };
  if (request === '@/server/workspace-projects') return { resolveWorkspaceProjectId: async () => null, moveDesignToWorkspaceProject: async () => null };
  if (request === '@/server/media-assets') return { ensureLegacyStoredObject: async key => `v2/uploads/legacy/${key}`, headStoredObject: async () => ({ contentType: 'image/png', byteSize: 1 }) };
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);

const { ensureV2Schema } = require('../src/server/db.ts');
const { getWorkspaceDesigns, getStudioProject } = require('../src/server/projects.ts');
const { getPublicShare, getPreviewShare, getMigratedShareAsset, revokeDesignShare } = require('../src/server/design-shares.ts');
const projectsRoute = require('../src/app/api/projects/route.ts');
const projectRoute = require('../src/app/api/projects/[id]/route.ts');

const PREVIEW = 'data:image/png;base64,iVBORw0KGgo=';
let seq = 0;
function legacyPayload(userId, overrides = {}) {
  const now = new Date().toISOString();
  return {
    name: 'Legacy Box', user_id: userId, created_at: now, updated_at: now,
    preview_token: `Prev${String(++seq).padStart(8, '0')}`,
    config: { dims: { width: 10, height: 10, length: 10 }, unit: 'cm', materialId: 'kraft', opening: 'closed' },
    images: { front: { s3Key: 'shares/front.png', v2StorageKey: 'v2/uploads/legacy/front.png', name: 'front.png', mime: 'image/png' } },
    ...overrides,
  };
}
async function addLegacy(sourceId, userId, overrides) {
  const payload = legacyPayload(userId, overrides);
  await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash) VALUES('v1','shared_designs',$1,$2,'h')", [sourceId, JSON.stringify(payload)]);
  return payload;
}
async function legacyRow(sourceId) {
  return (await db.query("SELECT deleted_at,payload FROM legacy_records WHERE source='v1' AND entity_type='shared_designs' AND source_id=$1", [sourceId])).rows[0];
}
async function shareRows(where, params) {
  return (await db.query(`SELECT * FROM design_shares WHERE ${where}`, params)).rows;
}
const routeArgs = id => ({ params: Promise.resolve({ id }) });

test.before(async () => {
  // Users must exist before the schema runs so the user_id backfill is exercised.
  await db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, password_hash TEXT, email_verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    INSERT INTO users(id,email) VALUES('u1','u1@example.com'),('u2','u2@example.com');`);
  await db.exec(`CREATE TABLE legacy_records (source TEXT NOT NULL, entity_type TEXT NOT NULL, source_id TEXT NOT NULL, payload JSONB NOT NULL, source_hash TEXT NOT NULL, synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ, PRIMARY KEY(source,entity_type,source_id));
    CREATE TABLE design_shares (id TEXT PRIMARY KEY, project_id TEXT, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, studio_state JSONB NOT NULL, preview_token TEXT, legacy_assets JSONB NOT NULL DEFAULT '{}'::jsonb, legacy_source BOOLEAN NOT NULL DEFAULT FALSE, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ, view_count BIGINT NOT NULL DEFAULT 0);`);
  // A share migrated by migrate-legacy-shares with user_id NULL (owner not yet in V2 at that time).
  const payload = await addLegacy('Backfill0001', 'u1');
  await db.query("INSERT INTO design_shares(id,user_id,name,studio_state,preview_token,legacy_source) VALUES('Backfill0001',NULL,'Legacy Box','{}'::jsonb,$1,TRUE)", [payload.preview_token]);
  await ensureV2Schema();
});
test.after(async () => { await db.close(); });

test('schema backfills user_id of migrated legacy share rows from the legacy owner', async () => {
  const [row] = await shareRows("id='Backfill0001'");
  assert.equal(row.user_id, 'u1');
});

test('saving an opened legacy design converts it into a V2 project, without duplicates, and moves its share link', async () => {
  currentUser = { id: 'u1', emailVerified: true };
  const payload = await addLegacy('Convert00001', 'u1', { name: 'Old Mailer' });
  // An already-migrated share row for this design, still without an owner.
  await db.query("INSERT INTO design_shares(id,user_id,name,studio_state,preview_token,legacy_source,legacy_assets) VALUES('Convert00001',NULL,'Old Mailer','{}'::jsonb,$1,TRUE,$2)", [payload.preview_token, JSON.stringify({ front: { storageKey: 'v2/uploads/legacy/front.png' } })]);

  const before = await getWorkspaceDesigns('u1', 'Old Mailer');
  assert.deepEqual(before.designs.map(d => [d.id, d.legacy]), [['v1:Convert00001', true]]);

  const opened = await getStudioProject('u1', 'v1:Convert00001');
  assert.equal(opened.legacyImport, true);
  assert.equal(opened.state.legacySourceId, 'v1:Convert00001');
  assert.ok(opened.state.mediaAssets.length, 'artwork media is carried into the user media library');
  const edited = { ...opened.state, dimensions: { ...opened.state.dimensions, width: 123 } };

  const response = await projectsRoute.POST(new Request('http://test/api/projects', { method: 'POST', body: JSON.stringify({ name: 'Old Mailer v2', state: edited, preview: PREVIEW }) }));
  assert.equal(response.status, 200);
  const { project } = await response.json();

  const after = await getWorkspaceDesigns('u1', 'Old Mailer');
  assert.deepEqual(after.designs.map(d => [d.id, d.legacy]), [[project.id, false]], 'only the V2 project is listed');
  const legacy = await legacyRow('Convert00001');
  assert.ok(legacy.deleted_at, 'legacy record retired');
  assert.equal(legacy.payload.v2_project_id, project.id);
  const blocks = (await db.query("SELECT id FROM admin_deleted_entities WHERE kind='legacy' AND id='v1:shared_designs:Convert00001'")).rows;
  assert.equal(blocks.length, 1, 'legacy sync will not resurrect the record');

  const [share] = await shareRows("id='Convert00001'");
  assert.equal(share.project_id, project.id);
  assert.equal(share.user_id, 'u1');
  assert.equal(share.revoked_at, null);

  const publicShare = await getPublicShare('Convert00001');
  assert.equal(publicShare.name, 'Old Mailer v2');
  assert.equal(publicShare.state.dimensions.width, 123);
  assert.equal((await getPreviewShare(payload.preview_token)).id, 'Convert00001');
  assert.ok(await getMigratedShareAsset('Convert00001', 'front'), 'old legacy-media URLs keep working');

  // Normal V2 revoke applies to the old V1 link.
  assert.equal(await revokeDesignShare('u2', 'Convert00001'), false);
  assert.equal(await revokeDesignShare('u1', 'Convert00001'), true);
  assert.equal(await getPublicShare('Convert00001'), null);
  assert.equal(await getPreviewShare(payload.preview_token), null);

  // Deleting the converted project does not bring the legacy entry back.
  const deleted = await projectRoute.DELETE(new Request(`http://test/api/projects/${project.id}`, { method: 'DELETE' }), routeArgs(project.id));
  assert.equal(deleted.status, 200);
  assert.equal((await getWorkspaceDesigns('u1', 'Old Mailer')).total, 0);
  assert.equal(await getPublicShare('Convert00001'), null);
});

test('converting a legacy design without a share row creates a V2 share under the legacy id', async () => {
  currentUser = { id: 'u1', emailVerified: true };
  const payload = await addLegacy('Convert00002', 'u1', { name: 'No Row Yet' });
  const opened = await getStudioProject('u1', 'v1:Convert00002');
  const response = await projectsRoute.POST(new Request('http://test/api/projects', { method: 'POST', body: JSON.stringify({ name: 'No Row Yet', state: opened.state, preview: PREVIEW }) }));
  const { project } = await response.json();
  const [share] = await shareRows("id='Convert00002'");
  assert.equal(share.project_id, project.id);
  assert.equal(share.preview_token, payload.preview_token);
  assert.equal((await getPublicShare('Convert00002')).name, 'No Row Yet');
  // A later V2 "share" of the project reuses the same link.
  const { upsertDesignShare } = require('../src/server/design-shares.ts');
  assert.equal((await upsertDesignShare('u1', { projectId: project.id, name: 'No Row Yet', state: opened.state })).id, 'Convert00002');
});

test('another user saving a state that names someone else\'s legacy id does not adopt it', async () => {
  currentUser = { id: 'u2', emailVerified: true };
  await addLegacy('Convert00003', 'u1', { name: 'Not Yours' });
  const opened = await getStudioProject('u1', 'v1:Convert00003');
  const response = await projectsRoute.POST(new Request('http://test/api/projects', { method: 'POST', body: JSON.stringify({ name: 'Copy', state: opened.state, preview: PREVIEW }) }));
  assert.equal(response.status, 200);
  assert.equal((await legacyRow('Convert00003')).deleted_at, null);
  assert.equal((await getWorkspaceDesigns('u1', 'Not Yours')).total, 1);
  assert.equal((await shareRows("id='Convert00003'")).length, 0);
});

test('owners can delete legacy designs from the library, which stops their shares', async () => {
  const payload = await addLegacy('Delete000001', 'u1', { name: 'Delete Me' });
  assert.ok(await getPublicShare('Delete000001'), 'share works before deletion');

  currentUser = { id: 'u2', emailVerified: true };
  const denied = await projectRoute.DELETE(new Request('http://test/api/projects/x', { method: 'DELETE' }), routeArgs('v1%3ADelete000001'));
  assert.equal(denied.status, 404, 'non-owner cannot delete');
  assert.equal((await legacyRow('Delete000001')).deleted_at, null);

  currentUser = { id: 'u1', emailVerified: true };
  const response = await projectRoute.DELETE(new Request('http://test/api/projects/x', { method: 'DELETE' }), routeArgs('v1%3ADelete000001'));
  assert.equal(response.status, 200);
  assert.ok((await legacyRow('Delete000001')).deleted_at);
  assert.equal((await getWorkspaceDesigns('u1', 'Delete Me')).total, 0);
  assert.equal(await getPublicShare('Delete000001'), null);
  assert.equal(await getPreviewShare(payload.preview_token), null);
  assert.equal(await getMigratedShareAsset('Delete000001', 'front'), null);
  const [share] = await shareRows("id='Delete000001'");
  assert.ok(share.revoked_at, 'V2 share row revoked');

  const again = await projectRoute.DELETE(new Request('http://test/api/projects/x', { method: 'DELETE' }), routeArgs('v1:Delete000001'));
  assert.equal(again.status, 404);
});

test('resolving a legacy share materializes a V2 design_shares row that V2 revocation controls', async () => {
  const payload = await addLegacy('Resolve00001', 'u1', { name: 'Shared Only', view_count: 7 });
  const share = await getPublicShare('Resolve00001');
  assert.equal(share.id, 'Resolve00001');
  assert.equal(share.legacy, true);
  const [row] = await shareRows("id='Resolve00001'");
  assert.equal(row.user_id, 'u1');
  assert.equal(row.preview_token, payload.preview_token);
  assert.equal(Number(row.view_count), 8);
  assert.equal(row.legacy_assets.front.storageKey, 'v2/uploads/legacy/front.png');

  assert.ok(await getPreviewShare(payload.preview_token));
  assert.ok(await getMigratedShareAsset('Resolve00001', 'front'));

  assert.equal(await revokeDesignShare('u1', 'Resolve00001'), true);
  // The legacy record is still active, but must not resurrect the revoked share.
  assert.equal((await legacyRow('Resolve00001')).deleted_at, null);
  assert.equal(await getPublicShare('Resolve00001'), null);
  assert.equal(await getPreviewShare(payload.preview_token), null);
  assert.equal(await getMigratedShareAsset('Resolve00001', 'front'), null);
});

test('owners can revoke never-resolved legacy shares and ownerless migrated rows', async () => {
  const fresh = await addLegacy('Revoke000001', 'u1');
  assert.equal(await revokeDesignShare('u2', 'Revoke000001'), false);
  assert.equal(await revokeDesignShare('u1', 'Revoke000001'), true);
  assert.equal(await getPublicShare('Revoke000001'), null);
  assert.equal(await getPreviewShare(fresh.preview_token), null);

  const orphan = await addLegacy('Revoke000002', 'u1');
  await db.query("INSERT INTO design_shares(id,user_id,name,studio_state,preview_token,legacy_source) VALUES('Revoke000002',NULL,'x',$1::jsonb,$2,TRUE)", [JSON.stringify((await getStudioProject('u1', 'v1:Revoke000002')).state), orphan.preview_token]);
  assert.ok(await getPublicShare('Revoke000002', false));
  assert.equal(await revokeDesignShare('u2', 'Revoke000002'), false);
  assert.equal(await revokeDesignShare('u1', 'Revoke000002'), true);
  assert.equal(await getPublicShare('Revoke000002'), null);
});

test('a V1 link whose migrated row kept only the preview token resolves to that row and honours its revocation', async () => {
  const payload = await addLegacy('OldIdOnly001', 'u1', { name: 'Token Keyed' });
  const state = (await getStudioProject('u1', 'v1:OldIdOnly001')).state;
  await db.query("INSERT INTO design_shares(id,user_id,name,studio_state,preview_token,legacy_source) VALUES('NewShareId01','u1','Token Keyed',$1::jsonb,$2,TRUE)", [JSON.stringify(state), payload.preview_token]);
  assert.equal((await getPublicShare('OldIdOnly001')).id, 'NewShareId01');
  assert.equal((await shareRows("id='OldIdOnly001'")).length, 0, 'no duplicate share row');
  assert.equal(await revokeDesignShare('u1', 'NewShareId01'), true);
  assert.equal(await getPublicShare('OldIdOnly001'), null);
  assert.equal(await getPreviewShare(payload.preview_token), null);
});
