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

const { listUsers, listDesigns, listUserDesigns, listUserProjects, getDesignPreviewSource, listMedia, getUser, getDesign, findListedMedia, getAdminDesignView } = require('../src/server/admin/catalog.ts');
const { emailUserHrefs } = require('../src/server/admin/email-users.ts');
const { mediaFileId, storageKeyFromMediaFileId } = require('../src/lib/admin-media.ts');
const { LEGACY_SYNC_SCHEMA } = require('../src/server/legacy-schema.ts');

test('admin catalog links media to owners and designs without inventing a design', async () => {
  db = new PGlite();
  try {
    await db.exec(LEGACY_SYNC_SCHEMA);
    await db.exec(`CREATE TABLE users(id text primary key, email text, name text, email_verified_at timestamptz, signup_method text, created_at timestamptz default now());
      CREATE TABLE workspace_projects(id text primary key, user_id text not null, name text not null, is_default boolean not null default false, created_at timestamptz default now(), updated_at timestamptz default now());
      CREATE TABLE projects(id text primary key, name text, user_id text, studio_state jsonb, preview_image_key text, workspace_project_id text, created_at timestamptz default now(), updated_at timestamptz default now());
      CREATE TABLE scenes(id text primary key, user_id text, workspace_project_id text, name text, scene_state jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
      CREATE TABLE media_assets(id text primary key, user_id text, name text, mime_type text, storage_key text, created_at timestamptz default now());
      CREATE TABLE design_shares(id text primary key, project_id text, preview_token text, revoked_at timestamptz, expires_at timestamptz);`);
    const now = new Date().toISOString();
    await db.query("INSERT INTO users(id,email,name,email_verified_at,signup_method) VALUES('u1','ada@example.com','Ada',NOW(),'google'),('u2','no-name@example.com',NULL,NULL,'password')");
    await db.query("INSERT INTO workspace_projects(id,user_id,name,is_default) VALUES('wp1','u1','My Project',TRUE),('wp2','u1','Client work',FALSE),('wp3','u2','My Project',TRUE)");
    await db.query('INSERT INTO projects(id,name,user_id,studio_state,workspace_project_id) VALUES($1,$2,$3,$4,$5)', ['p1', 'Studio carton', 'u1', { artworkByPanel: { Front: { url: '/api/media/m2', name: 'box' } } }, 'wp2']);
    await db.query("INSERT INTO scenes(id,user_id,workspace_project_id,name) VALUES('s1','u1','wp2','Shelf')");
    await db.query('INSERT INTO media_assets(id,user_id,name,mime_type,storage_key) VALUES($1,$2,$3,$4,$5),($6,$7,$8,$9,$10)', [
      'm1', 'u1', 'loose.png', 'image/png', 'v2/uploads/users/u1/artwork/m1/loose.png',
      'm2', 'u1', 'box.png', 'image/png', 'v2/uploads/users/u1/artwork/m2/box.png',
    ]);
    await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash) VALUES('v1','shared_designs',$1,$2,'hash')", ['d1', JSON.stringify({
      name: 'Mailer', user_id: 'u1', created_at: now, updated_at: now, view_count: 4, preview_token: 'previewtoken1',
      images: {
        front: { name: 'front.png', mime: 'image/png', s3Key: 'shares/d1/front.png' },
        back: { name: 'back.png', mime: 'image/png', s3Key: 'shares/d1/back.png' },
      },
      og_image_key: 'shares/d1/og.png',
    })]);
    await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash) VALUES('v1','shared_designs',$1,$2,'hash')", ['d2', JSON.stringify({
      name: 'Anonymous box', created_at: now,
      images: { front: { name: 'anon.png', mime: 'image/jpeg', s3Key: 'shares/d2/front.jpg' } },
    })]);

    const media = await listMedia({ pageSize: 50 });
    assert.equal(media.total, 6);
    const loose = media.items.find((item) => item.name === 'loose.png');
    const linked = media.items.find((item) => item.name === 'box.png');
    const front = media.items.find((item) => item.name === 'front.png');
    const anon = media.items.find((item) => item.name === 'anon.png');
    assert.equal(loose.designs.length, 0);
    assert.equal(loose.user.name, 'Ada');
    assert.equal(loose.user.href, '/admin/users/u1');
    assert.equal(linked.designs[0].name, 'Studio carton');
    assert.equal(linked.designs[0].href, '/admin/designs/p1');
    assert.equal(front.designs[0].href, '/admin/designs/v1%3Ad1');
    assert.equal(anon.user, null);

    assert.deepEqual(await emailUserHrefs(['Ada <ADA@EXAMPLE.COM>', ' no-name@example.com ', 'missing@example.com', 'ada@example.com']), {
      'ada@example.com': '/admin/users/u1',
      'no-name@example.com': '/admin/users/u2',
    });
    assert.deepEqual(await emailUserHrefs([]), {});

    const users = await listUsers();
    assert.equal(users.total, 2);
    assert.equal(users.items.find((user) => user.id === 'u1').projectCount, 2);
    assert.equal(users.items.find((user) => user.id === 'u1').designCount, 2);
    assert.equal(users.items.find((user) => user.id === 'u1').mediaCount, 5);
    assert.equal(users.items.find((user) => user.id === 'u2').projectCount, 1);
    assert.equal(users.items.find((user) => user.id === 'u2').name, 'no-name@example.com');
    assert.deepEqual((await listUsers({ sort: 'name', dir: 'asc' })).items.map((user) => user.id), ['u1', 'u2']);
    assert.equal((await listUsers({ sort: 'designs', dir: 'asc' })).items[0].id, 'u2');
    assert.equal((await listUsers({ sort: 'projects', dir: 'asc' })).items[0].id, 'u2');
    assert.equal((await listUsers({ sort: 'not-a-column', dir: 'sideways' })).items.length, 2);
    assert.equal((await listDesigns({ sort: 'name', dir: 'asc' })).items[0].name, 'Anonymous box');
    assert.equal((await listMedia({ sort: 'name', dir: 'asc', pageSize: 50 })).items[0].name, 'anon.png');
    assert.equal((await listMedia({ sort: 'designs', dir: 'asc', pageSize: 50 })).items[0].name, 'loose.png');

    const designs = await listDesigns();
    assert.equal(designs.total, 3);
    assert.equal(designs.items.find((design) => design.id === 'v1:d1').previewHref, '/preview/previewtoken1');
    assert.equal(designs.items.find((design) => design.id === 'v1:d1').thumbnailUrl, '/api/admin/designs/v1%3Ad1/preview');
    assert.equal(designs.items.find((design) => design.id === 'p1').previewHref, '/admin/designs/p1/view');
    assert.equal(designs.items.find((design) => design.id === 'p1').thumbnailUrl, `/api/admin/media/file?id=${encodeURIComponent(mediaFileId('v2/uploads/users/u1/artwork/m2/box.png'))}`);
    assert.equal(designs.items.find((design) => design.id === 'v1:d2').previewHref, '/admin/designs/v1%3Ad2/view');
    const mailer = await getDesign('v1:d1');
    assert.equal(mailer.name, 'Mailer');
    assert.equal(mailer.imageCount, 3);
    assert.equal(mailer.user.href, '/admin/users/u1');
    assert.equal(mailer.images.length, 3);
    assert.equal(await getDesign('missing'), null);
    const account = await getUser('u1');
    assert.equal(account.email, 'ada@example.com');
    assert.equal(account.projectCount, 2);
    assert.equal(account.designs.length, 2);
    assert.equal(await getUser('missing'), null);
    const adaDesigns = await listUserDesigns('u1');
    assert.equal(adaDesigns.total, 2);
    assert.equal(adaDesigns.items.find((design) => design.id === 'v1:d1').thumbnailUrl, '/api/admin/designs/v1%3Ad1/preview');
    assert.equal(adaDesigns.items.find((design) => design.id === 'v1:d1').previewHref, '/preview/previewtoken1');
    assert.equal(adaDesigns.items.find((design) => design.id === 'p1').thumbnailUrl, `/api/admin/media/file?id=${encodeURIComponent(mediaFileId('v2/uploads/users/u1/artwork/m2/box.png'))}`);
    assert.equal(adaDesigns.items.find((design) => design.id === 'p1').previewHref, '/admin/designs/p1/view');
    const adaProjects = await listUserProjects('u1');
    assert.equal(adaProjects.total, 2);
    assert.equal(adaProjects.items[0].id, 'wp1');
    assert.equal(adaProjects.items[0].isDefault, true);
    assert.equal(adaProjects.items[0].designCount, 0);
    assert.equal(adaProjects.items.find((project) => project.id === 'wp2').name, 'Client work');
    assert.equal(adaProjects.items.find((project) => project.id === 'wp2').designCount, 1);
    assert.equal(adaProjects.items.find((project) => project.id === 'wp2').sceneCount, 1);
    assert.equal(adaProjects.items.find((project) => project.id === 'wp2').href, '/admin/designs?user=u1');
    assert.equal((await listUserProjects('u2')).total, 1);
    assert.deepEqual(await getDesignPreviewSource('v1:d1'), { storageKey: 'shares/d1/og.png' });
    assert.equal(await getDesignPreviewSource('missing'), null);
    const legacyView = await getAdminDesignView('v1:d1');
    assert.equal(legacyView?.legacy, true);
    assert.equal(legacyView?.name, 'Mailer');
    assert.match(legacyView?.state.artworkByPanel.Front.url || '', /\/api\/admin\/designs\/v1%3Ad1\/legacy-media\/front$/);
    assert.equal(await getAdminDesignView('p1'), null);
    assert.equal(await getAdminDesignView('missing'), null);

    assert.equal((await findListedMedia('shares/d1/front.png')).name, 'front.png');
    assert.equal(await findListedMedia('shares/missing.png'), null);
    assert.equal(await findListedMedia('../secrets'), null);
    assert.equal(storageKeyFromMediaFileId(mediaFileId('shares/d1/front.png')), 'shares/d1/front.png');
    assert.equal(storageKeyFromMediaFileId(mediaFileId('https://example.com/secret')), null);
  } finally {
    await db.close();
  }
});
