/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
let db, failStorage = false, beforeTransaction = null, authenticated = true;
const deletedKeys = [];
const query = (text, params = []) => ({ text, params, then(resolve, reject) { return db.query(text, params).then(r => r.rows).then(resolve, reject); } });
const sql = { query, transaction: async queries => {
  if (beforeTransaction) { const mutate = beforeTransaction; beforeTransaction = null; await mutate(); }
  await db.exec('BEGIN');
  try { const rows = []; for (const q of queries) rows.push(await q); await db.exec('COMMIT'); return rows; }
  catch (error) { await db.exec('ROLLBACK'); throw error; }
} };
const originalLoad = Module._load, originalResolve = Module._resolveFilename;
Module._load = function(request, ...args) {
  if (request === '@/server/db') return { ensureV2Schema: async () => {}, getSql: () => sql };
  if (request === '@/server/media-assets') return { deleteStoredObject: async key => { if (failStorage) throw new Error('Mock storage failure'); deletedKeys.push(key); } };
  if (request === '@/server/admin/auth') return { requireAdminApi: async () => authenticated ? null : Response.json({error:'Unauthorized'}, {status:401}) };
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function(request, ...args) { return originalResolve.call(this, request.startsWith('@/') ? path.resolve(__dirname,'../src',request.slice(2)) : request, ...args); };
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { previewDeletion, executeDeletion, retryDeletionFiles, pendingDeletionJobs } = require('../src/server/admin/deletions.ts');
const { mediaFileId } = require('../src/lib/admin-media.ts');
const route = require('../src/app/api/admin/deletions/route.ts');
const { LEGACY_SYNC_SCHEMA } = require('../src/server/legacy-schema.ts');
async function setup() {
  db = new PGlite(); deletedKeys.length = 0; failStorage = false; authenticated = true;
  await db.exec(LEGACY_SYNC_SCHEMA);
  await db.exec(`
    CREATE TABLE users(id text PRIMARY KEY,name text,email text);
    CREATE TABLE workspace_projects(id text PRIMARY KEY,user_id text REFERENCES users(id) ON DELETE CASCADE,name text,is_default boolean default false);
    CREATE TABLE projects(id text PRIMARY KEY,user_id text REFERENCES users(id) ON DELETE CASCADE,workspace_project_id text REFERENCES workspace_projects(id) ON DELETE SET NULL,name text,studio_state jsonb,preview_image_key text,revision int default 1,updated_at timestamptz default now());
    CREATE TABLE scenes(id text PRIMARY KEY,user_id text REFERENCES users(id) ON DELETE CASCADE,workspace_project_id text REFERENCES workspace_projects(id) ON DELETE CASCADE,name text,scene_state jsonb,preview_image_key text,revision int default 1,updated_at timestamptz default now());
    CREATE TABLE design_shares(id text PRIMARY KEY,user_id text REFERENCES users(id) ON DELETE CASCADE,project_id text REFERENCES projects(id) ON DELETE CASCADE,name text,studio_state jsonb,legacy_assets jsonb default '{}',legacy_source boolean default false,updated_at timestamptz default now());
    CREATE TABLE media_assets(id text PRIMARY KEY,user_id text REFERENCES users(id) ON DELETE CASCADE,name text,storage_key text);
    CREATE TABLE sessions(token text,user_id text REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE oauth_accounts(id text,user_id text REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE email_verification_tokens(token text,user_id text REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE password_reset_tokens(token text,user_id text REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE legacy_migrations(target_id text);
    CREATE TABLE admin_deletion_files(job_id text,storage_key text,created_at timestamptz default now(),PRIMARY KEY(job_id,storage_key));
    INSERT INTO users VALUES('u1','Ada','ada@example.com'),('u2','Bob','bob@example.com');
    INSERT INTO workspace_projects VALUES('f1','u1','Client work',false),('f2','u1','My Project',true),('f3','u2','Other',false);
    INSERT INTO media_assets VALUES('m1','u1','shared.png','v2/uploads/shared.png'),('m2','u1','only.png','v2/uploads/only.png'),('m3','u1','unused.png','v2/uploads/unused.png');
    INSERT INTO sessions VALUES('secret','u1'); INSERT INTO oauth_accounts VALUES('google','u1');
    INSERT INTO email_verification_tokens VALUES('secret','u1'); INSERT INTO password_reset_tokens VALUES('secret','u1');
  `);
  await db.query('INSERT INTO projects(id,user_id,workspace_project_id,name,studio_state,preview_image_key) VALUES($1,$2,$3,$4,$5,$6)', ['d1','u1','f1','Box', { artworkByPanel:{Front:{assetId:'m2',url:'/api/media/m2',name:'only.png'}}, outsideArtworkLayers:[{assetId:'m1',url:'/api/media/m1',name:'shared.png'}], insideArtworkLayers:[],mediaAssets:[{id:'m1',url:'/api/media/m1',name:'shared.png'},{id:'m2',url:'/api/media/m2',name:'only.png'}]}, 'v2/uploads/preview.png']);
  await db.query('INSERT INTO projects(id,user_id,workspace_project_id,name,studio_state) VALUES($1,$2,$3,$4,$5)', ['d2','u1','f2','Keep', {artworkByPanel:{},outsideArtworkLayers:[],insideArtworkLayers:[],mediaAssets:[{id:'m1',url:'/api/media/m1',name:'shared.png'}]}]);
  await db.query('INSERT INTO scenes(id,user_id,workspace_project_id,name,scene_state) VALUES($1,$2,$3,$4,$5)', ['sc1','u1','f1','Scene', {objects:[{id:'obj',sourceDesignId:'d1'}],background:{type:'transparent'}}]);
  await db.query('INSERT INTO scenes(id,user_id,workspace_project_id,name,scene_state) VALUES($1,$2,$3,$4,$5)', ['sc2','u1','f2','Kept scene', {objects:[{id:'obj',sourceDesignId:'d1'},{id:'keep',sourceDesignId:'d2'}],background:{type:'transparent'}}]);
  await db.query('INSERT INTO design_shares(id,user_id,project_id,name,studio_state) VALUES($1,$2,$3,$4,$5)', ['share1','u1','d1','Box share',{outsideArtworkLayers:[{assetId:'m2',url:'/api/media/m2'}]}]);
}
async function count(table) { return (await db.query(`SELECT COUNT(*)::int AS n FROM ${table}`)).rows[0].n; }
async function remove(kind,id) { const preview = await previewDeletion(kind,id); return executeDeletion(kind,id,preview.token); }
test('admin cascade deletion', async t => {
  await t.test('project deletes designs, scenes, shares and exclusive media; retains reused media', async () => {
    await setup(); try {
      const p = await previewDeletion('project','f1');
      assert.deepEqual(p.groups.find(g=>g.label==='Designs').items.map(i=>i.id),['d1']);
      assert.ok(p.groups.find(g=>g.label==='Stored files (including previews)').items.some(i=>i.name==='v2/uploads/preview.png'));
      assert.equal(p.retainedMedia.length,1); assert.equal(p.updates[0].items[0].id,'sc2');
      assert.equal((await executeDeletion('project','f1',p.token)).pendingFiles,0);
      assert.equal(await count('projects'),1); assert.equal(await count('workspace_projects'),2);
      assert.equal(await count('scenes'),1); assert.equal(await count('design_shares'),0);
      assert.equal(await count('media_assets'),2);
      assert.deepEqual(deletedKeys.sort(),['v2/uploads/only.png','v2/uploads/preview.png']);
      assert.deepEqual((await db.query("SELECT scene_state FROM scenes WHERE id='sc2'")).rows[0].scene_state.objects.map(o=>o.sourceDesignId),['d2']);
    } finally { await db.close(); }
  });
  await t.test('cascade preserves a file also present in another account media library', async () => {
    await setup(); try {
      await db.query("INSERT INTO media_assets VALUES('other-account','u2','Other library copy','v2/uploads/only.png')");
      const p=await previewDeletion('design','d1');
      assert.ok(p.retainedMedia.some(m=>m.name==='only.png'));
      await executeDeletion('design','d1',p.token);
      assert.ok(!deletedKeys.includes('v2/uploads/only.png'));
      assert.equal(await count('media_assets'),4);
    } finally { await db.close(); }
  });
  await t.test('direct media removes placements from every surviving design and share', async () => {
    await setup(); try {
      await db.query('INSERT INTO design_shares(id,user_id,project_id,name,studio_state) VALUES($1,$2,$3,$4,$5)', ['share2','u1','d2','Keep share',{mediaAssets:[{id:'m1',url:'/api/media/m1'}]}]);
      await db.query("UPDATE scenes SET scene_state=jsonb_set(scene_state,'{background}',$1::jsonb) WHERE id='sc2'", [{type:'image',url:'/api/media/m1'}]);
      const p = await previewDeletion('media',mediaFileId('v2/uploads/shared.png'));
      assert.equal(p.updates.find(g=>g.label.startsWith('Designs:')).items.length,2);
      await executeDeletion('media',p.id,p.token);
      assert.equal(await count('projects'),2); assert.equal(await count('media_assets'),2);
      const d=(await db.query("SELECT studio_state,preview_image_key,revision FROM projects WHERE id='d1'")).rows[0];
      assert.equal(d.revision,2); assert.equal(d.studio_state.outsideArtworkLayers.length,0);
      assert.equal(d.studio_state.artworkByPanel.Front.assetId,'m2');
      assert.deepEqual(d.studio_state.mediaAssets.map(m=>m.id),['m2']);
      assert.equal(d.preview_image_key,null);
      assert.ok(deletedKeys.includes('v2/uploads/preview.png'));
      assert.deepEqual((await db.query("SELECT studio_state FROM design_shares WHERE id='share2'")).rows[0].studio_state.mediaAssets,[]);
      assert.deepEqual((await db.query("SELECT scene_state FROM scenes WHERE id='sc2'")).rows[0].scene_state.background,{type:'transparent'});
    } finally { await db.close(); }
  });
  await t.test('user includes orphan uploads, legacy designs and auth records; other account survives', async () => {
    await setup(); try {
      await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash) VALUES('v1','shared_designs','legacy',$1,'hash')", [{name:'Legacy',user_id:'u1',images:{front:{s3Key:'shares/old.png',v2StorageKey:'v2/uploads/legacy/old.png'}}}]);
      const p=await previewDeletion('user','u1');
      assert.equal(p.groups.find(g=>g.label==='Login and verification records').items.length,4);
      assert.equal(p.groups.find(g=>g.label==='Legacy designs').items[0].name,'Legacy');
      assert.equal((await executeDeletion('user','u1',p.token)).pendingFiles,0);
      assert.equal(await count('users'),1); assert.equal(await count('projects'),0);
      assert.equal(await count('workspace_projects'),1); assert.equal(await count('media_assets'),0);
      assert.equal(await count('sessions'),0); assert.equal(await count('oauth_accounts'),0);
      assert.equal((await db.query("SELECT payload,deleted_at FROM legacy_records")).rows[0].payload.user_id,undefined);
      assert.ok(deletedKeys.includes('v2/uploads/unused.png'));
      assert.equal((await db.query("SELECT id FROM admin_deleted_entities WHERE kind='user'")).rows[0].id,'u1');
    } finally { await db.close(); }
  });
  await t.test('rejects stale, forged and raced confirmations without deleting', async () => {
    await setup(); try {
      const p=await previewDeletion('design','d1');
      await assert.rejects(executeDeletion('design','d1',p.token+'x'),e=>e.status===409);
      await db.query("UPDATE projects SET name='Renamed' WHERE id='d1'");
      await assert.rejects(executeDeletion('design','d1',p.token),e=>e.status===409);
      const fresh=await previewDeletion('design','d1');
      beforeTransaction=()=>db.query("INSERT INTO media_assets VALUES('raced','u1','New','v2/uploads/new.png')");
      await assert.rejects(executeDeletion('design','d1',fresh.token),e=>e.status===409);
      assert.equal(await count('projects'),2); assert.equal(deletedKeys.length,0);
      await assert.rejects(previewDeletion('media',mediaFileId('../secret')),e=>e.status===404);
    } finally { await db.close(); }
  });
  await t.test('storage failures remain durable and retry safely', async () => {
    await setup(); try {
      failStorage=true;
      const oldError=console.error; console.error=()=>{};
      let result; try { result=await remove('design','d1'); } finally { console.error=oldError; }
      assert.equal(result.pendingFiles,2); assert.equal(await count('projects'),1);
      assert.equal((await pendingDeletionJobs())[0].keys.length,2);
      failStorage=false; assert.equal((await retryDeletionFiles(result.jobId)).pendingFiles,0);
      assert.equal((await retryDeletionFiles(result.jobId)).pendingFiles,0);
    } finally { await db.close(); }
  });
  await t.test('legacy source and migrated file aliases are removed together', async () => {
    await setup(); try {
      await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash) VALUES('v1','shared_designs','legacy',$1,'hash')", [{name:'Legacy',images:{front:{s3Key:'shares/old.png',v2StorageKey:'v2/uploads/legacy/old.png'},back:{s3Key:'shares/keep.png'}}}]);
      await db.query('INSERT INTO design_shares(id,name,studio_state,legacy_assets,legacy_source) VALUES($1,$2,$3,$4,true)', ['legacy','Legacy',{artworkByPanel:{Front:{assetId:'legacy-share-front',url:'/api/shares/legacy/legacy-media/front'}},mediaAssets:[{id:'legacy-share-front',fingerprint:'shares/old.png'}]},{front:{storageKey:'v2/uploads/legacy/old.png'}}]);
      await remove('media',mediaFileId('shares/old.png'));
      assert.ok(deletedKeys.includes('shares/old.png')); assert.ok(deletedKeys.includes('v2/uploads/legacy/old.png'));
      const legacy=(await db.query('SELECT payload FROM legacy_records')).rows[0].payload;
      const shared=(await db.query("SELECT studio_state,legacy_assets FROM design_shares WHERE id='legacy'")).rows[0];
      assert.deepEqual(shared.studio_state.artworkByPanel,{});
      assert.deepEqual(shared.legacy_assets,{});
      assert.equal(legacy.images.front,undefined); assert.equal(legacy.images.back.s3Key,'shares/keep.png');
      assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM admin_deleted_entities WHERE kind='legacy'")).rows[0].n,1);
    } finally { await db.close(); }
  });
  await t.test('imported design deletes its legacy original and migrated public share', async () => {
    await setup(); try {
      await db.query("UPDATE projects SET studio_state=studio_state || '{\"legacySourceId\":\"v1:original\"}' WHERE id='d1'");
      await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash) VALUES('v1','shared_designs','original',$1,'hash')", [{name:'Original',user_id:'u1',images:{}}]);
      await db.query("INSERT INTO design_shares(id,user_id,name,studio_state,legacy_source) VALUES('original','u1','Legacy share','{}',true)");
      const p=await previewDeletion('design','d1');
      assert.equal(p.groups.find(g=>g.label==='Legacy designs').items[0].id,'v1:original');
      assert.equal(p.groups.find(g=>g.label==='Share links').items.length,2);
      await executeDeletion('design','d1',p.token);
      assert.equal(await count('design_shares'),0);
      assert.ok((await db.query("SELECT deleted_at FROM legacy_records WHERE source_id='original'")).rows[0].deleted_at);
    } finally { await db.close(); }
  });
  await t.test('API requires admin authentication, same-origin writes, and confirmation', async () => {
    await setup(); try {
      authenticated=false;
      assert.equal((await route.GET(new Request('https://example.com/api/admin/deletions?kind=user&id=u1'))).status,401);
      assert.equal((await route.POST(new Request('https://example.com/api/admin/deletions',{method:'POST',body:'{}'}))).status,401);
      authenticated=true;
      assert.equal((await route.POST(new Request('https://example.com/api/admin/deletions',{method:'POST',headers:{origin:'https://evil.example'},body:JSON.stringify({kind:'user',id:'u1'})}))).status,403);
      assert.equal((await route.POST(new Request('https://example.com/api/admin/deletions',{method:'POST',headers:{origin:'https://example.com'},body:JSON.stringify({kind:'user',id:'u1'})}))).status,400);
      assert.equal(await count('users'),2);
    } finally { await db.close(); }
  });
});
