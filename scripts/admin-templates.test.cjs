/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

// Admin → Templates against a real Postgres (PGlite): settings, overrides,
// named and uploaded templates, design counts and the designs filter, and
// that a design whose template is made inactive still validates and opens.

const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
let db;
const sql = async (strings, ...params) => (await db.query(strings.reduce((query, part, index) => query + part + (index < params.length ? '$' + (index + 1) : ''), ''), params)).rows;
sql.query = async (query, params) => (await db.query(query, params)).rows;
Module._load = function (request, ...args) {
  if (request === '@/server/db') return { ensureV2Schema: async () => {}, getSql: () => sql };
  if (request === '@/server/media-assets') return { headStoredObject: async () => { throw new Error('unavailable'); } };
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function (request, ...args) {
  return originalResolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '../src', request.slice(2)) : request, ...args);
};
require.extensions['.ts'] = require.extensions['.tsx'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
// Read settings straight from the database (outside Next there is no data cache).
process.env.DATABASE_URL ||= 'postgresql://pglite';

const admin = require('../src/server/admin/templates.ts');
const { countDesignsByTemplate, readTemplateSettings, getTemplateCatalog } = require('../src/server/templates.ts');
const { TEMPLATE_SETTINGS_SCHEMA } = require('../src/server/template-sql.ts');
const { LEGACY_SYNC_SCHEMA } = require('../src/server/legacy-schema.ts');
const { ADMIN_READ_MODEL_SCHEMA } = require('../src/server/admin/read-model-schema.ts');
const { listDesigns } = require('../src/server/admin/catalog.ts');
const catalog = require('../src/lib/packaging/template-catalog.ts');
const { getPackagingTemplateCopy } = require('../src/lib/i18n/template-copy.ts');
const { getPackagingTemplate } = require('../src/lib/packaging/template-registry.ts');
const { getTemplateRuntime } = require('../src/lib/packaging/template-runtime.ts');
const { validProjectState } = require('../src/lib/studio-project.ts');
const { migrateStudioLayout } = require('../src/lib/packaging/layout-migration.ts');
const { catalogDielineStyles } = require('../src/lib/dieline/styles.ts');
const { withStyleCount, WRITTEN_STYLE_COUNT } = require('../src/lib/template-count-copy.ts');
const { evaluate } = require('../src/lib/packaging/parametric/expression.ts');
const { trayBoxDefinition } = require('../src/lib/packaging/parametric/definitions/tray-box.ts');

async function freshDatabase() {
  db = new PGlite();
  await db.exec(LEGACY_SYNC_SCHEMA);
  await db.exec(`CREATE TABLE users(id text primary key, email text, name text, email_verified_at timestamptz, signup_method text, pro_access_at timestamptz, created_at timestamptz default now(), utm_source text, utm_campaign text, signup_landing_page text, signup_landing_type text, signup_referrer text, migrated_from text);
    CREATE TABLE workspace_projects(id text primary key, user_id text not null, name text not null, is_default boolean not null default false, created_at timestamptz default now(), updated_at timestamptz default now());
    CREATE TABLE projects(id text primary key, name text, user_id text, studio_state jsonb, preview_image_key text, workspace_project_id text, created_at timestamptz default now(), updated_at timestamptz default now());
    CREATE TABLE media_assets(id text primary key, user_id text, name text, mime_type text, byte_size bigint, storage_key text, created_at timestamptz default now());
    CREATE TABLE design_shares(id text primary key, project_id text, preview_token text, revoked_at timestamptz, expires_at timestamptz, view_count bigint not null default 0);
    CREATE TABLE export_feedback(id text primary key, user_id text, project_id text, rating smallint, comment text, export_format text, template_id text, created_at timestamptz default now());`);
  for (const statement of ADMIN_READ_MODEL_SCHEMA) await db.exec(statement);
  for (const statement of TEMPLATE_SETTINGS_SCHEMA) await db.exec(statement);
}

/** A saved design's state, as the Studio writes it. */
function designState(templateId, extra = {}) {
  const template = getPackagingTemplate(templateId);
  return {
    version: 1, templateId, dimensions: template.defaultDimensions, material: 'Kraft', opening: 0, formation: 100,
    measurementUnit: 'mm', artworkByPanel: {}, outsideArtworkLayers: [], insideArtworkLayers: [], mediaAssets: [],
    outsideColorMode: 'material', insideColorMode: 'material', outsideCustomColor: '#ffffff', insideCustomColor: '#ffffff', ...extra,
  };
}

const uploadable = (templateId) => JSON.stringify({ ...trayBoxDefinition, templateId, catalog: { ...trayBoxDefinition.catalog, thumbnail: undefined, name: 'Test tray' } });

test('built-in templates are active and unchanged until an admin changes them', async () => {
  await freshDatabase();
  const { templates } = await admin.listAdminTemplates();
  assert.equal(templates.length, 16);
  assert.ok(templates.every(entry => entry.source === 'built-in' && entry.active && !entry.customized));
  assert.equal(catalog.activeStyleCount(templates), WRITTEN_STYLE_COUNT);
  assert.deepEqual(await readTemplateSettings(), []);
});

test('making a template inactive hides it from lists and counts, and existing designs still open', async () => {
  await freshDatabase();
  await admin.setTemplateActive('pizza-box', false);
  let entries = await getTemplateCatalog();
  assert.equal(catalog.listedTemplates(entries).some(entry => entry.id === 'pizza-box'), false);
  assert.equal(entries.find(entry => entry.id === 'pizza-box').active, false);
  assert.equal(catalog.activeStyleCount(entries), WRITTEN_STYLE_COUNT - 1);
  assert.ok(catalog.inactiveTemplateIds(entries).has('pizza-box'));
  assert.equal(catalogDielineStyles(entries).some(style => style.templateId === 'pizza-box'), false);
  assert.equal(withStyleCount('16 box styles, Sixteen box templates, 16 estilos; 16 mm', catalog.activeStyleCount(entries)), '15 box styles, 15 box templates, 15 estilos; 16 mm');

  // The design, its layout migration and its runtime don't care that the template is hidden.
  const saved = designState('pizza-box', { layoutVersion: 1 });
  assert.equal(validProjectState(saved), true);
  const migrated = migrateStudioLayout(saved);
  assert.equal(migrated.templateId, 'pizza-box');
  assert.ok(getTemplateRuntime('pizza-box').buildMeshes({ dimensions: saved.dimensions, formation: 100, opening: 0, openingMode: 'closed', splitTopHingeSide: 'side_a', color: [1, 1, 1], interiorColor: [1, 1, 1] }).length > 0);
  // It still resolves to its own entry for display, though no list shows it.
  assert.equal(catalog.catalogEntryFor(entries, saved).id, 'pizza-box');

  await admin.setTemplateActive('pizza-box', true);
  entries = await getTemplateCatalog();
  assert.equal(catalog.listedTemplates(entries).length, 16);
});

test('the last active style cannot be made inactive', async () => {
  await freshDatabase();
  for (const entry of (await admin.listAdminTemplates()).templates.slice(1)) await admin.setTemplateActive(entry.id, false);
  const last = (await getTemplateCatalog()).find(entry => entry.active);
  await assert.rejects(admin.setTemplateActive(last.id, false), /at least one/);
});

test('overrides apply wherever the template is listed, and Reset to original clears them', async () => {
  await freshDatabase();
  await admin.setTemplateActive('hexagon-box', false);
  await admin.updateTemplateFields('hexagon-box', { name: 'Candle hexagon', description: 'For candles.', category: 'Candles', order: '-5', width: '90', height: '', depth: '', thickness: '', defaultMaterial: 'Kraft' });
  let entry = (await getTemplateCatalog()).find(item => item.id === 'hexagon-box');
  assert.equal(entry.name, 'Candle hexagon');
  assert.equal(getPackagingTemplateCopy(entry).name, 'Candle hexagon');
  assert.equal(getPackagingTemplateCopy(entry).category, 'Candles');
  assert.equal(entry.order, -5);
  assert.equal(entry.defaultDimensions.width, 90);
  // The fields left empty keep the style's own.
  assert.equal(entry.defaultDimensions.height, getPackagingTemplate('hexagon-box').defaultDimensions.height);
  assert.equal(entry.defaultMaterial, 'Kraft');
  assert.ok(entry.customized);
  await admin.setTemplateActive('hexagon-box', true);
  const listed = catalog.listedTemplates(await getTemplateCatalog());
  assert.equal(listed[0].id, 'hexagon-box');
  const style = catalogDielineStyles(listed).find(item => item.templateId === 'hexagon-box');
  assert.equal(style.name, 'Candle hexagon');
  assert.equal(style.defaults.length, 90);

  await assert.rejects(admin.updateTemplateFields('hexagon-box', { width: '5' }), /at least 40/);
  await assert.rejects(admin.updateTemplateFields('hexagon-box', { defaultMaterial: 'Gold leaf' }), /Studio materials/);
  await assert.rejects(admin.updateTemplateFields('hexagon-box', { thumbnail: 'https://evil.example/x.png' }), /Upload/);

  await admin.resetTemplateFields('hexagon-box');
  entry = (await getTemplateCatalog()).find(item => item.id === 'hexagon-box');
  assert.equal(entry.name, getPackagingTemplate('hexagon-box').name);
  assert.equal(entry.customized, false);
  assert.equal(entry.active, true);
});

test('a named template uses its style\'s engine with its own name and defaults', async () => {
  await freshDatabase();
  const id = await admin.createNamedTemplate({ slug: 'candle-box-80x100', baseTemplateId: 'hexagon-box', name: 'Candle box 80×100', description: 'Hexagon candle box.', width: '80', height: '100', depth: '', thickness: '' });
  assert.equal(id, 'candle-box-80x100');
  const entries = await getTemplateCatalog();
  const entry = entries.find(item => item.id === id);
  assert.equal(entry.source, 'named');
  assert.equal(entry.templateId, 'hexagon-box');
  assert.equal(entry.presetId, id);
  assert.equal(entry.defaultDimensions.width, 80);
  assert.equal(catalog.templateIdOf(entry), 'hexagon-box');
  assert.equal(getPackagingTemplateCopy(entry).name, 'Candle box 80×100');
  // The generator offers it on the hexagon box's measure.
  const style = catalogDielineStyles(entries).find(item => item.id === id);
  assert.equal(style.templateId, 'hexagon-box');
  assert.equal(style.defaults.length, 80);
  assert.ok(style.generate({ styleId: id, ...style.defaults, units: 'mm', dimensionMode: 'inner' }).paths.length > 0);
  // A design made from it keeps the style's id; the named id is display only.
  const saved = designState('hexagon-box', { presetId: id, dimensions: entry.defaultDimensions });
  assert.equal(validProjectState(saved), true);
  assert.equal(catalog.catalogEntryFor(entries, saved).id, id);
  assert.equal(validProjectState({ ...saved, presetId: 'Not An Id!' }), false);

  await assert.rejects(admin.createNamedTemplate({ slug: 'pizza-box', baseTemplateId: 'hexagon-box', name: 'Clash' }), /already used/);
  await assert.rejects(admin.createNamedTemplate({ slug: 'candle-box-80x100', baseTemplateId: 'hexagon-box', name: 'Again' }), /already used/);
  await assert.rejects(admin.createNamedTemplate({ slug: 'no-name-box', baseTemplateId: 'hexagon-box', name: '' }), /Enter a name/);
  await admin.setTemplateActive('cake-box', false);
  await assert.rejects(admin.createNamedTemplate({ slug: 'cake-copy', baseTemplateId: 'cake-box', name: 'Cake copy' }), /inactive/);

  // It can be made inactive and deleted while no design uses it.
  await admin.setTemplateActive(id, false);
  assert.equal(catalog.listedTemplates(await getTemplateCatalog()).some(item => item.id === id), false);
  await admin.deleteTemplate(id);
  assert.equal((await getTemplateCatalog()).some(item => item.id === id), false);
  await assert.rejects(admin.deleteTemplate('base-box'), /Only named/);
});

test('an uploaded JSON definition is checked on the server and saved as an inactive draft', async () => {
  await freshDatabase();
  const rejected = async (source, pattern) => {
    await assert.rejects(admin.createJsonTemplate(source), error => {
      assert.equal(error.status, 422, error.message);
      assert.match(error.message, pattern);
      return true;
    });
  };
  await rejected('{ not json', /valid JSON/);
  await rejected('[]', /JSON object/);
  await rejected(JSON.stringify({ ...JSON.parse(uploadable('x-tray')), format: 'other/1' }), /format/);
  await rejected(uploadable('Bad Id'), /templateId/);
  const withDerived = (id, entry) => { const definition = JSON.parse(uploadable(id)); definition.derived.push(entry); return JSON.stringify(definition); };
  await rejected(withDerived('broken-tray', ['oops', 'nope + 1']), /does not compile: Unknown value "nope"/);
  // Data, not code: nothing outside the expression language is reachable.
  await rejected(withDerived('evil-tray', ['evil', 'constructor(1)']), /Unknown function "constructor"/);
  await rejected(withDerived('long-tray', ['long', `thickness${' + 1'.repeat(200)}`]), /limited to 400/);
  await rejected(JSON.stringify({ ...JSON.parse(uploadable('huge-tray')), panels: [{ repeat: Array.from({ length: 400 }, (_, i) => ({ i })), each: Array.from({ length: 400 }, () => ({ id: 'p{{i}}' })) }] }), /expands to/);
  await assert.rejects(admin.createJsonTemplate(uploadable('tray-box')), /already used/);
  assert.throws(() => evaluate('constructor(1)', {}), /Unknown function/);

  const created = await admin.createJsonTemplate(uploadable('test-tray'));
  assert.equal(created.id, 'test-tray');
  assert.match(created.svg, /^<\?xml[\s\S]*<g id="CUT"/);
  const entries = await getTemplateCatalog();
  const entry = entries.find(item => item.id === 'test-tray');
  assert.equal(entry.source, 'json');
  assert.equal(entry.active, false);
  assert.equal(entry.name, 'Test tray');
  assert.equal(catalog.listedTemplates(entries).some(item => item.id === 'test-tray'), false);
  // Registered for every lookup by id: runtime, validation, exports.
  assert.ok(getTemplateRuntime('test-tray'));
  assert.equal(validProjectState(designState('test-tray')), true);
  assert.ok(getTemplateRuntime('test-tray').getExportGeometry(getPackagingTemplate('test-tray').defaultDimensions).cut.length > 0);
  // Clients get active definitions, and an inactive one only when a design needs it.
  const records = await readTemplateSettings();
  assert.equal(catalog.clientTemplateRecords(records).some(record => record.id === 'test-tray'), false);
  assert.equal(catalog.clientTemplateRecords(records, ['test-tray']).some(record => record.id === 'test-tray'), true);

  await admin.setTemplateActive('test-tray', true);
  const listed = catalog.listedTemplates(await getTemplateCatalog());
  assert.ok(listed.some(item => item.id === 'test-tray'));
  assert.equal(catalog.activeStyleCount(listed), WRITTEN_STYLE_COUNT + 1);
  assert.ok(catalogDielineStyles(listed).some(style => style.id === 'test-tray'));
  await assert.rejects(admin.deleteTemplate('test-tray'), /Only named/);
});

test('design counts and the designs filter follow named templates and legacy designs', async () => {
  await freshDatabase();
  await admin.createNamedTemplate({ slug: 'candle-box', baseTemplateId: 'hexagon-box', name: 'Candle box' });
  await db.query("INSERT INTO users(id,email,name) VALUES('u1','ada@example.com','Ada')");
  const insert = (id, state) => db.query('INSERT INTO projects(id,name,user_id,studio_state) VALUES($1,$2,$3,$4)', [id, `Design ${id}`, 'u1', state]);
  await insert('p1', designState('hexagon-box'));
  await insert('p2', designState('hexagon-box', { presetId: 'candle-box' }));
  await insert('p3', designState('hexagon-box', { presetId: 'candle-box' }));
  await insert('p4', designState('split-top-box'));
  await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash) VALUES('v1','shared_designs','d1',$1,'h'),('v1','shared_designs','d2',$2,'h')", [
    JSON.stringify({ name: 'Old split', user_id: 'u1', config: { opening: 'top_split_meet_center' } }),
    JSON.stringify({ name: 'Old tuck', user_id: 'u1', config: { opening: 'lid_from_back' } }),
  ]);
  const counts = await countDesignsByTemplate();
  assert.equal(counts.get('hexagon-box'), 1);
  assert.equal(counts.get('candle-box'), 2);
  assert.equal(counts.get('split-top-box'), 2);
  assert.equal(counts.get('base-box'), 1);
  const { templates } = await admin.listAdminTemplates();
  assert.equal(templates.find(entry => entry.id === 'candle-box').designCount, 2);

  const named = await listDesigns({ template: 'candle-box' });
  assert.deepEqual(named.items.map(item => item.id).sort(), ['p2', 'p3']);
  assert.equal(named.total, 2);
  assert.ok(named.items.every(item => item.templateName === 'Candle box' && item.templateId === 'hexagon-box'));
  const split = await listDesigns({ template: 'split-top-box', sort: 'name', dir: 'asc' });
  assert.deepEqual(split.items.map(item => item.name), ['Design p4', 'Old split']);
  // With the search and paging too.
  const searched = await listDesigns({ template: 'candle-box', q: 'p3', pageSize: 1 });
  assert.deepEqual(searched.items.map(item => item.id), ['p3']);
  assert.equal((await listDesigns({})).total, 6);
  assert.equal((await listDesigns({ template: 'hexagon-box' })).items[0].templateName, getPackagingTemplate('hexagon-box').name);
  // Deleting a named template that designs use is refused.
  await assert.rejects(admin.deleteTemplate('candle-box'), /Designs use/);
});
