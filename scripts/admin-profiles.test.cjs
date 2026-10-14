/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

let db;
const sql = async (strings, ...params) => (await db.query(strings.reduce((query, part, index) => query + part + (index < params.length ? '$' + (index + 1) : ''), ''), params)).rows;
sql.query = async (query, params) => (await db.query(query, params)).rows;
const originalLoad = Module._load, originalResolve = Module._resolveFilename;
Module._load = function (request, ...args) {
  if (request === '@/server/db') return { ensureV2Schema: async () => {}, getSql: () => sql };
  if (request === '@/server/media-assets') return { headStoredObject: async () => ({ byteSize: 1 }) };
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);

const { getUserProfile, getDesignProfile } = require('../src/server/admin/profiles.ts');
const { listAdminContacts, setContactStatus } = require('../src/server/admin/contacts.ts');
const { listAdminFeedback } = require('../src/server/admin/feedback.ts');
const { listUsers, listDesigns } = require('../src/server/admin/catalog.ts');
const { LEGACY_SYNC_SCHEMA } = require('../src/server/legacy-schema.ts');
const { ADMIN_READ_MODEL_SCHEMA } = require('../src/server/admin/read-model-schema.ts');

async function setup() {
  db = new PGlite();
  await db.exec(LEGACY_SYNC_SCHEMA);
  await db.exec(`CREATE TABLE users(id text primary key, email text, name text, email_verified_at timestamptz, signup_method text, created_at timestamptz default now(),
      utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text, signup_landing_page text, signup_landing_type text, signup_conversion_page text, signup_referrer text, migrated_from text);
    CREATE TABLE sessions(token text primary key, user_id text, created_at timestamptz default now());
    CREATE TABLE oauth_accounts(provider text, provider_account_id text, user_id text);
    CREATE TABLE workspace_projects(id text primary key, user_id text not null, name text not null, is_default boolean not null default false, created_at timestamptz default now(), updated_at timestamptz default now());
    CREATE TABLE projects(id text primary key, name text, user_id text, studio_state jsonb, preview_image_key text, workspace_project_id text, created_at timestamptz default now(), updated_at timestamptz default now());
    CREATE TABLE scenes(id text primary key, user_id text, workspace_project_id text, name text, created_at timestamptz default now(), updated_at timestamptz default now());
    CREATE TABLE media_assets(id text primary key, user_id text, name text, mime_type text, byte_size bigint, storage_key text, created_at timestamptz default now());
    CREATE TABLE admin_media_sizes(storage_key text primary key, byte_size bigint, checked_at timestamptz default now());
    CREATE TABLE design_shares(id text primary key, project_id text, user_id text, preview_token text, revoked_at timestamptz, expires_at timestamptz, view_count bigint not null default 0);
    CREATE TABLE export_feedback(id text primary key, user_id text, project_id text, rating smallint, comment text, export_format text, template_id text, created_at timestamptz default now());
    CREATE TABLE contact_submissions(id text primary key, status text not null default 'new', email text not null, name text, topic text, subject text, message text, page_path text, created_at timestamptz default now(), updated_at timestamptz default now());`);
  for (const statement of ADMIN_READ_MODEL_SCHEMA) await db.exec(statement);
  await db.query(`INSERT INTO users(id,email,name,email_verified_at,signup_method,utm_source,utm_medium,utm_campaign,signup_landing_page,signup_conversion_page,signup_referrer,created_at)
    VALUES('u1','Ada@Example.com','Ada',NOW(),'google','instagram','social','spring','/templates/pizza-box','/studio','https://www.instagram.com/p/1',NOW()-interval '10 days'),
          ('u2','bo@example.com',NULL,NULL,'password',NULL,NULL,NULL,NULL,NULL,'https://www.google.com/search?q=box',NOW())`);
  await db.query("INSERT INTO oauth_accounts VALUES('google','g1','u1')");
  await db.query("INSERT INTO sessions(token,user_id,created_at) VALUES('s1','u1',NOW()-interval '1 hour')");
  await db.query("INSERT INTO workspace_projects(id,user_id,name,is_default) VALUES('wp1','u1','My Project',TRUE),('wp2','u1','Client work',FALSE)");
  await db.query('INSERT INTO projects(id,name,user_id,studio_state,preview_image_key,workspace_project_id,updated_at) VALUES($1,$2,$3,$4,$5,$6,NOW()-interval \'2 days\'),($7,$8,$9,$10,NULL,$11,NOW()-interval \'5 days\')', [
    'p1', 'Pizza night', 'u1', { templateId: 'pizza-box', dimensions: { width: 305, height: 45, depth: 305 }, outsideArtworkLayers: [], insideArtworkLayers: [], artworkByPanel: {} }, 'v2/previews/p1.png', 'wp2',
    'p2', 'Mailer', 'u1', { templateId: 'mailer-box', dimensions: { width: 200, height: 80, depth: 150 } }, 'wp1',
  ]);
  await db.query("INSERT INTO design_shares(id,project_id,user_id,preview_token,view_count) VALUES('sh1','p1','u1','tok1234567890',42)");
  await db.query("INSERT INTO export_feedback(id,user_id,project_id,rating,comment,export_format,template_id,created_at) VALUES('f1','u1','p1',5,'Lovely','pdf','pizza-box',NOW()-interval '1 day'),('f2','u1','p1',3,NULL,'png','pizza-box',NOW()),('f3',NULL,NULL,1,'Broken','mp4','mailer-box',NOW())");
  await db.query("INSERT INTO contact_submissions(id,email,name,subject,message,status) VALUES('c1',' ada@example.com','Ada','Bulk order','Can you print 500?','new'),('c2','stranger@example.com','Sam','Hello','Hi','new')");
  await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash) VALUES('v1','contact_submissions','old1',$1,'h')", [JSON.stringify({ email: 'bo@example.com', name: 'Bo', subject: 'Old question', message: 'From before', created_at: '2024-01-01T00:00:00Z' })]);
  await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash) VALUES('v1','shared_designs','d1',$1,'h')", [JSON.stringify({ name: 'Old split top', user_id: 'u2', created_at: '2024-02-02T00:00:00Z', view_count: 7, preview_token: 'legacytoken12', config: { opening: 'top_split_meet_center', unit: 'cm', dims: { width: 30, height: 20, length: 25 } } })]);
}

test('a user profile shows where they came from, their work and what they told us', async () => {
  await setup();
  try {
    const profile = await getUserProfile('u1');
    assert.equal(profile.source, 'instagram');
    assert.equal(profile.campaign, 'spring');
    assert.equal(profile.campaignDetail.medium, 'social');
    assert.equal(profile.landing, '/templates/pizza-box');
    assert.equal(profile.campaignDetail.conversionPage, '/studio');
    assert.deepEqual(profile.providers, ['google']);
    assert.equal(profile.activeShares, 1);
    assert.ok(profile.lastActiveAt && Date.now() - Date.parse(profile.lastActiveAt) < 2 * 3600000, 'sign-in an hour ago is the latest activity');
    assert.deepEqual(profile.projects.map((p) => [p.name, p.designCount]), [['My Project', 1], ['Client work', 1]]);
    assert.deepEqual(profile.designs.map((d) => d.name), ['Pizza night', 'Mailer']);
    assert.deepEqual(profile.feedback.map((f) => f.rating), [3, 5]);
    // Contact messages match the account's address whatever its case and spacing.
    assert.deepEqual(profile.contacts.map((c) => c.subject), ['Bulk order']);
    assert.equal(await getUserProfile('nobody'), null);
    // The second user came from a search engine: the referrer's host stands in for a UTM source.
    const users = await listUsers({ sort: 'joined', dir: 'asc' });
    assert.equal(users.items[1].source, 'google.com');
    assert.deepEqual(users.items[0].recentDesigns.map((d) => [d.name, Boolean(d.thumbnailUrl)]), [['Pizza night', true], ['Mailer', false]]);
  } finally { await db.close(); }
});

test('design rows and profiles carry the box, size, folder, share views and ratings', async () => {
  await setup();
  try {
    const designs = await listDesigns({ sort: 'name', dir: 'asc' });
    const pizza = designs.items.find((d) => d.id === 'p1');
    assert.equal(pizza.templateId, 'pizza-box');
    assert.equal(pizza.size, '305 × 45 × 305 mm');
    assert.equal(pizza.folder, 'Client work');
    assert.equal(pizza.sharedLink, true);
    assert.equal(pizza.views, 42);
    assert.deepEqual(pizza.rating, { average: 4, count: 2 });
    assert.equal(pizza.user.email, 'Ada@Example.com');
    const legacy = designs.items.find((d) => d.id === 'v1:d1');
    assert.equal(legacy.templateId, 'split-top-box');
    assert.equal(legacy.size, '30 × 20 × 25 cm');
    assert.equal(legacy.views, 7);
    assert.equal(legacy.rating, null);
    const profile = await getDesignProfile('p1');
    assert.deepEqual(profile.feedback.map((f) => f.comment), [null, 'Lovely']);
    assert.equal((await getDesignProfile('v1%3Ad1')).name, 'Old split top');
  } finally { await db.close(); }
});

test('contacts include the previous site, link accounts by address, and change status', async () => {
  await setup();
  try {
    const all = await listAdminContacts();
    assert.equal(all.total, 3);
    const ada = all.items.find((c) => c.id === 'c1');
    assert.deepEqual(ada.user, { id: 'u1', name: 'Ada' });
    const old = all.items.find((c) => c.legacy);
    assert.equal(old.subject, 'Old question');
    assert.equal(old.user.id, 'u2');
    assert.equal(old.status, 'handled');
    assert.equal((await listAdminContacts({ status: 'new' })).total, 2);
    assert.equal((await listAdminContacts({ q: '500' })).items[0].id, 'c1');
    assert.equal(await setContactStatus('c1', 'handled'), true);
    assert.equal(await setContactStatus('missing', 'handled'), false);
    assert.deepEqual((await listAdminContacts({ status: 'new' })).items.map((c) => c.id), ['c2']);
  } finally { await db.close(); }
});

test('feedback filters by rating and comments, with the design and person', async () => {
  await setup();
  try {
    const all = await listAdminFeedback();
    assert.equal(all.total, 3);
    assert.equal(all.items.find((f) => f.id === 'f1').design.thumbnailUrl, '/api/admin/designs/p1/preview');
    assert.equal(all.items.find((f) => f.id === 'f3').user, null);
    assert.deepEqual((await listAdminFeedback({ rating: '5' })).items.map((f) => f.id), ['f1']);
    assert.deepEqual((await listAdminFeedback({ comments: '1' })).items.map((f) => f.id).sort(), ['f1', 'f3']);
    assert.equal((await listAdminFeedback({ rating: '9' })).rating, 0);
  } finally { await db.close(); }
});
