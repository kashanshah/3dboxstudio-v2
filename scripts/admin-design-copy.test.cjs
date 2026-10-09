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
const copies = [];
const sql = async (strings, ...params) => (await db.query(strings.reduce((query, part, index) => query + part + (index < params.length ? '$' + (index + 1) : ''), ''), params)).rows;
sql.query = async (query, params) => (await db.query(query, params)).rows;
Module._load = function (request, ...args) {
  if (request === '@/server/db') return { ensureV2Schema: async () => {}, getSql: () => sql };
  if (request === '@/server/workspace-projects') return { resolveWorkspaceProjectId: async () => 'wp-admin' };
  if (request === '@/server/media-assets') return { copyStoredObjectToUser: async (userId, source) => {
    copies.push({ userId, ...source });
    const id = `copy-${copies.length}`;
    return { id, name: source.name, url: `/api/media/${id}`, mimeType: source.mimeType, byteSize: 1, width: source.width, height: source.height, fingerprint: source.fingerprint || id, createdAt: 0 };
  } };
  if (request === '@/server/admin/catalog') return { getAdminDesignLegacyMedia: async (_id, faceId) => faceId === 'front' ? { storageKey: 'v2/uploads/legacy/d9/front.png', mime: 'image/png', name: 'front.png' } : null };
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);

const { duplicateDesignForUser } = require('../src/server/admin/duplicate-design.ts');

const layer = (id, assetId) => ({ id, assetId, name: id, url: `/api/media/${assetId}`, aspectRatio: 1, transform: { x: 50, y: 50, width: 40, height: 40, rotation: 0 } });
const asset = (id) => ({ id, name: `${id}.png`, url: `/api/media/${id}`, mimeType: 'image/png', byteSize: 10, width: 100, height: 100, fingerprint: `fp-${id}`, createdAt: 0 });
const ownerState = {
  version: 1, templateId: 'reverse-tuck-carton', layoutVersion: 5, legacySourceId: 'v1:old',
  dimensions: { width: 60, height: 120, depth: 40, thickness: 0.5 }, material: 'White board', opening: 0, measurementUnit: 'mm',
  artworkByPanel: { Front: { assetId: 'a2', name: 'front', url: '/api/media/a2', mode: 'fill', scale: 100, rotation: 0, alignX: 0, alignY: 0 } },
  outsideArtworkLayers: [layer('L1', 'a1')], insideArtworkLayers: [],
  mediaAssets: [asset('a1'), asset('a2'), asset('gone')],
  outsideColorMode: 'material', insideColorMode: 'material', outsideCustomColor: '#ffffff', insideCustomColor: '#ffffff',
};

test.before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE TABLE projects(id TEXT PRIMARY KEY, user_id TEXT, name TEXT, studio_state JSONB, preview_image_key TEXT, workspace_project_id TEXT);
    CREATE TABLE media_assets(id TEXT PRIMARY KEY, user_id TEXT, name TEXT, mime_type TEXT, byte_size BIGINT, width INT, height INT, storage_key TEXT, fingerprint TEXT);
    CREATE TABLE legacy_records(source TEXT, entity_type TEXT, source_id TEXT, payload JSONB, deleted_at TIMESTAMPTZ);
  `);
  await db.query(`INSERT INTO projects VALUES('p1','owner','Owner box',$1,'data:image/png;base64,AAAA','wp-owner')`, [JSON.stringify(ownerState)]);
  for (const id of ['a1', 'a2']) await db.query(`INSERT INTO media_assets VALUES($1,'owner',$2,'image/png',10,100,100,$3,$4)`, [id, `${id}.png`, `owner/${id}.png`, `fp-${id}`]);
  // Another account's image with the same id is never copied.
  await db.query(`INSERT INTO media_assets VALUES('gone','someone-else','x.png','image/png',10,1,1,'x/gone.png','fp-x')`);
  await db.query(`INSERT INTO legacy_records VALUES('v1','shared_designs','d9',$1,NULL)`, [JSON.stringify({ name: 'Old box', user_id: 'owner', config: { dims: { w: 10, h: 10, d: 10 }, unit: 'cm' }, images: { front: { s3Key: 'shares/d9/front.png', name: 'front.png' } } })]);
});

test('an admin copy of a design opens in the signed-in account with its own copies of the images', async () => {
  const result = await duplicateDesignForUser('p1', 'admin-user');
  assert.ok(result);
  const [copy] = await sql`SELECT * FROM projects WHERE id=${result.id}`;
  assert.equal(copy.user_id, 'admin-user');
  assert.equal(copy.name, 'Owner box (admin copy)');
  assert.equal(copy.workspace_project_id, 'wp-admin');
  assert.equal(copy.preview_image_key, 'data:image/png;base64,AAAA');
  const state = copy.studio_state;
  assert.equal(state.legacySourceId, undefined, 'the copy is not the owner\'s legacy design');
  assert.deepEqual(copies.map(item => [item.userId, item.storageKey]).sort(), [['admin-user', 'owner/a1.png'], ['admin-user', 'owner/a2.png']]);
  const ids = new Set(state.mediaAssets.map(item => item.id));
  assert.equal(state.mediaAssets.length, 2, 'images the copy cannot load are left out of its library');
  assert.ok(ids.has(state.outsideArtworkLayers[0].assetId) && state.outsideArtworkLayers[0].url === `/api/media/${state.outsideArtworkLayers[0].assetId}`);
  assert.ok(ids.has(state.artworkByPanel.Front.assetId) && state.artworkByPanel.Front.url.startsWith('/api/media/copy-'));
  // The original is untouched.
  const [original] = await sql`SELECT * FROM projects WHERE id='p1'`;
  assert.deepEqual(original.studio_state, ownerState);
});

test('a legacy design is converted and copied the same way', async () => {
  copies.length = 0;
  const result = await duplicateDesignForUser('v1:d9', 'admin-user');
  assert.ok(result);
  const [copy] = await sql`SELECT * FROM projects WHERE id=${result.id}`;
  assert.equal(copy.user_id, 'admin-user');
  assert.match(copy.name, /\(admin copy\)$/);
  assert.equal(copy.studio_state.legacySourceId, undefined);
  assert.deepEqual(copies.map(item => item.storageKey), ['v2/uploads/legacy/d9/front.png']);
  assert.ok(JSON.stringify(copy.studio_state).includes('/api/media/copy-1'));
});

test('an unknown design copies nothing', async () => {
  assert.equal(await duplicateDesignForUser('nope', 'admin-user'), null);
});
