/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const load=Module._load,resolve=Module._resolveFilename;
let projectDb,currentUser='owner', emailDelivery=null;
const sql=async(strings,...params)=>(await projectDb.query(strings.reduce((out,part,i)=>out+part+(i<params.length?'$'+(i+1):''),''),params)).rows;
sql.query=async(query,params)=>(await projectDb.query(query,params)).rows;
Module._load=function(request,...args){if(request==='@/server/db')return {ensureV2Schema:async()=>{},getSql:()=>sql};if(request==='./db')return {ensureV2Schema:async()=>{},getSql:()=>sql};if(request==='@/server/auth/session')return {getCurrentUser:async()=>currentUser?{id:currentUser}:null};if(request==='@/server/auth/action-request')return {guardAuthAction:()=>null};if(request==='@/server/email/mailer')return {sendEmail:async(input)=>{if(emailDelivery)return emailDelivery(input);throw Error('unexpected email call');}};return load.call(this,request,...args);};
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {RESET_PASSWORD_SQL,VERIFY_EMAIL_SQL,tokenDigest,issueEmailAction}=require('../src/server/auth/email-actions.ts');
const {isValidEmail,cleanName}=require('../src/server/auth/validation.ts');
const {safeReturnTo}=require('../src/lib/auth-navigation.ts');
const {validProjectState}=require('../src/lib/studio-project.ts');
test('valid emails and names work; return URLs stay on the site',()=>{
 assert.equal(isValidEmail('kashan@example.com'),true);assert.equal(isValidEmail('bad email@example.com'),false);assert.equal(isValidEmail('a@b'),false);assert.equal(cleanName(' A   Name '),'A Name');
 for(const next of ['https://evil.example','//evil.example','/\\evil.example','/login?next=/accounts','/'])assert.equal(safeReturnTo(next),'/studio');
 assert.equal(safeReturnTo('/studio/editor?project=a'),'/studio/editor?project=a');
});
test('project state accepts persistable artwork and rejects temporary blob URLs',()=>{
 const state={version:1,templateId:'reverse-tuck-carton',dimensions:{width:120,height:180,depth:55,thickness:.5},material:'Kraft',opening:100,measurementUnit:'mm',artworkByPanel:{Front:{name:'art',url:'data:image/png;base64,abc'}},outsideArtworkLayers:[],insideArtworkLayers:[],mediaAssets:[],outsideColorMode:'material',insideColorMode:'material',outsideCustomColor:'#ffffff',insideCustomColor:'#ffffff'};
 assert.equal(validProjectState(state),true);assert.equal(validProjectState({...state,dimensions:{...state.dimensions,width:0}}),false);assert.equal(validProjectState({...state,artworkByPanel:{Front:{name:'art',url:'blob:temporary'}}}),false);
});
test('PostgreSQL email actions: expired/reused links fail, verification matches email, reset revokes sessions',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE TABLE users(id text primary key,email text,password_hash text,email_verified_at timestamptz);CREATE TABLE sessions(token text,user_id text);CREATE TABLE password_reset_tokens(token text primary key,user_id text,expires_at timestamptz,consumed_at timestamptz);CREATE TABLE email_verification_tokens(token text primary key,user_id text,email text,expires_at timestamptz,consumed_at timestamptz);INSERT INTO users VALUES('u','u@example.com','old',NULL),('other','other@example.com','other-old',NULL);INSERT INTO sessions VALUES('session','u'),('other-session','other');INSERT INTO password_reset_tokens VALUES('reset','u',NOW()+INTERVAL '1 hour',NULL),('older','u',NOW()+INTERVAL '1 hour',NULL),('expired','u',NOW()-INTERVAL '1 hour',NULL);INSERT INTO email_verification_tokens VALUES('verify','u','u@example.com',NOW()+INTERVAL '1 hour',NULL),('wrong-email','other','old@example.com',NOW()+INTERVAL '1 hour',NULL);`);
 assert.equal((await db.query(RESET_PASSWORD_SQL,['expired','bad'])).rows.length,0);
 assert.equal((await db.query(RESET_PASSWORD_SQL,['reset','new-hash'])).rows.length,1);
 assert.equal((await db.query(RESET_PASSWORD_SQL,['reset','bad'])).rows.length,0);
 assert.equal((await db.query(RESET_PASSWORD_SQL,['older','bad'])).rows.length,0);
 assert.deepEqual((await db.query('SELECT * FROM sessions')).rows,[{token:'other-session',user_id:'other'}]);
 assert.equal((await db.query("SELECT password_hash FROM users WHERE id='u'")).rows[0].password_hash,'new-hash');
 assert.ok((await db.query("SELECT email_verified_at FROM users WHERE id='u'")).rows[0].email_verified_at,'a completed reset proves inbox ownership');
 assert.equal((await db.query(VERIFY_EMAIL_SQL,['wrong-email'])).rows.length,0);
 assert.equal((await db.query(VERIFY_EMAIL_SQL,['verify'])).rows.length,1);
 assert.equal((await db.query(VERIFY_EMAIL_SQL,['verify'])).rows.length,0);
 assert.notEqual(tokenDigest('secret-token'),'secret-token');
 }finally{await db.close();}
});

const {saveProject}=require('../src/server/project-save.ts');
const {getStudioProject,getWorkspaceDesigns}=require('../src/server/projects.ts');
test('project saves/opening/library enforce ownership and prevent stale overwrites',async()=>{
 projectDb=new PGlite();try{
 await projectDb.exec(`CREATE TABLE workspace_projects(id text primary key,user_id text,name text,is_default boolean not null default false,created_at timestamptz default now(),updated_at timestamptz default now());CREATE UNIQUE INDEX workspace_projects_default_idx ON workspace_projects(user_id) WHERE is_default=true;CREATE TABLE projects(id text primary key,user_id text,name text,studio_state jsonb,preview_image_key text,is_favorite boolean not null default false,revision integer not null default 1,workspace_project_id text,created_at timestamptz default now(),updated_at timestamptz default now());CREATE TABLE scenes(id text primary key,user_id text,workspace_project_id text,name text,scene_state jsonb,created_at timestamptz default now(),updated_at timestamptz default now());CREATE TABLE legacy_records(source text,entity_type text,source_id text,payload jsonb,deleted_at timestamptz);`);
 const state={version:1,templateId:'reverse-tuck-carton',dimensions:{width:120,height:180,depth:55,thickness:.5},material:'Kraft',opening:100,measurementUnit:'mm',artworkByPanel:{},outsideArtworkLayers:[],insideArtworkLayers:[],mediaAssets:[],outsideColorMode:'material',insideColorMode:'material',outsideCustomColor:'#ffffff',insideCustomColor:'#ffffff'};
 const request=(body)=>new Request('https://app.example/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const body={name:'My box',state,preview:'data:image/png;base64,abc'};
 currentUser='owner';const first=await saveProject(request(body));assert.equal(first.status,200);const {project}=await first.json();
 const opened=await getStudioProject('owner',project.id);assert.equal(opened.state.dimensions.width,120);assert.ok(opened.workspaceProjectId);assert.equal(opened.favorite,false);assert.equal(opened.revision,1);assert.equal(await getStudioProject('stranger',project.id),null);
 currentUser='stranger';assert.equal((await saveProject(request({...body,revision:project.revision}),project.id)).status,409);assert.equal((await getWorkspaceDesigns('stranger')).total,0);
 currentUser='owner';const changed=await saveProject(request({...body,name:'Updated box',revision:project.revision}),project.id);assert.equal(changed.status,200);const changedProject=(await changed.json()).project;assert.equal(changedProject.revision,2);
 assert.equal((await saveProject(request({...body,revision:project.revision}),project.id)).status,409);
 const again=await saveProject(request({...body,name:'Saved again',revision:changedProject.revision}),project.id);assert.equal(again.status,200);assert.equal((await again.json()).project.revision,3);
 const library=(await getWorkspaceDesigns('owner')).designs[0];assert.equal(library.name,'Saved again');assert.equal(library.favorite,false);
 currentUser=null;assert.equal((await saveProject(request(body))).status,401);
 }finally{await projectDb.close();currentUser='owner';}
});

const projectRoute=require('../src/app/api/projects/[id]/route.ts');
test('design rename PATCH validates names, enforces ownership, and never causes a save conflict',async()=>{
 projectDb=new PGlite();currentUser='owner';
 try{
  await projectDb.exec(`CREATE TABLE workspace_projects(id text primary key,user_id text,name text,is_default boolean not null default false,created_at timestamptz default now(),updated_at timestamptz default now());CREATE UNIQUE INDEX workspace_projects_default_idx ON workspace_projects(user_id) WHERE is_default=true;CREATE TABLE projects(id text primary key,user_id text,name text,studio_state jsonb,preview_image_key text,is_favorite boolean not null default false,revision integer not null default 1,workspace_project_id text,created_at timestamptz default now(),updated_at timestamptz default now());CREATE TABLE legacy_records(source text,entity_type text,source_id text,payload jsonb,deleted_at timestamptz);`);
  const state={version:1,templateId:'reverse-tuck-carton',dimensions:{width:120,height:180,depth:55,thickness:.5},material:'Kraft',opening:100,measurementUnit:'mm',artworkByPanel:{},outsideArtworkLayers:[],insideArtworkLayers:[],mediaAssets:[],outsideColorMode:'material',insideColorMode:'material',outsideCustomColor:'#ffffff',insideCustomColor:'#ffffff'};
  const save=(body,id)=>saveProject(new Request('https://app.example/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,preview:'data:image/png;base64,abc',...body})}),id);
  const {project}=await (await save({name:'Original'})).json();
  const patch=(body,id=project.id)=>projectRoute.PATCH(new Request(`https://app.example/api/projects/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({id})});
  const stored=async()=>(await projectDb.query('SELECT name,revision FROM projects WHERE id=$1',[project.id])).rows[0];
  for(const name of ['','   ','x'.repeat(121),42,null]){const response=await patch({name});assert.equal(response.status,400);assert.match((await response.json()).error,/design name/);}
  currentUser='stranger';assert.equal((await patch({name:'Hacked'})).status,404);
  currentUser=null;assert.equal((await patch({name:'Hacked'})).status,401);
  currentUser='owner';assert.equal((await patch({name:'Missing'},'missing')).status,404);
  assert.deepEqual(await stored(),{name:'Original',revision:1});
  const renamed=await patch({name:'  Renamed box  '});assert.equal(renamed.status,200);assert.deepEqual((await renamed.json()).project,{id:project.id,name:'Renamed box',revision:1});
  assert.deepEqual(await stored(),{name:'Renamed box',revision:1},'rename keeps the revision so open editors can still save');
  assert.equal((await patch({name:'x'.repeat(120)})).status,200);await patch({name:'Renamed box'});
  // An editor tab opened before the rename saves with its old revision and old name: no conflict, rename kept.
  const stale=await save({name:'Original',baseName:'Original',revision:1},project.id);assert.equal(stale.status,200);assert.deepEqual((await stale.json()).project.name,'Renamed box');
  assert.deepEqual(await stored(),{name:'Renamed box',revision:2});
  // A name the editor typed itself still wins; older clients without baseName keep last-write-wins.
  assert.equal((await (await save({name:'Typed in editor',baseName:'Renamed box',revision:2},project.id)).json()).project.name,'Typed in editor');
  assert.equal((await (await save({name:'No base name',revision:3},project.id)).json()).project.name,'No base name');
 }finally{await projectDb.close();currentUser='owner';}
});

const {renderVerificationTemplate,renderPasswordResetTemplate}=require('../src/server/email/templates.ts');
test('email action delivery uses preview renderers, rate limits, and removes tokens on failure',async()=>{
 projectDb=new PGlite();const previous=process.env.AUTH_APP_URL;process.env.AUTH_APP_URL='https://studio.example';
 try{
  await projectDb.exec(`CREATE TABLE email_verification_tokens(token text primary key,user_id text,email text,expires_at timestamptz,created_at timestamptz default now());CREATE TABLE password_reset_tokens(token text primary key,user_id text,expires_at timestamptz,created_at timestamptz default now());`);
  const user={id:'email-user',email:'alex@example.com',name:'Alex <&>'};
  let delivered;emailDelivery=async(input)=>{delivered=input;};
  for(const kind of ['verify','reset']){
   assert.equal(await issueEmailAction(user,kind),true);
   const url=delivered.text.match(/https:\/\/studio\.example\/[^\s]+/)[0];
   const rendered=kind==='verify'?renderVerificationTemplate({name:user.name,verifyUrl:url}):renderPasswordResetTemplate({name:user.name,resetUrl:url});
   assert.deepEqual(delivered,{to:user.email,...rendered});
   const table=kind==='verify'?'email_verification_tokens':'password_reset_tokens';
   const rows=(await projectDb.query(`SELECT token FROM ${table}`)).rows;
   assert.equal(rows[0].token,tokenDigest(new URL(url).searchParams.get('token')));
   assert.equal(await issueEmailAction(user,kind),false);
  }
  emailDelivery=async()=>{throw Error('delivery unavailable');};
  await assert.rejects(issueEmailAction({...user,id:'failed-user'},'verify'),/delivery unavailable/);
  assert.equal((await projectDb.query("SELECT token FROM email_verification_tokens WHERE user_id='failed-user'")).rows.length,0);
  process.env.AUTH_APP_URL='javascript:bad';
  await assert.rejects(issueEmailAction({...user,id:'invalid-origin'},'verify'));
  assert.equal((await projectDb.query("SELECT token FROM email_verification_tokens WHERE user_id='invalid-origin'")).rows.length,0);
 }finally{emailDelivery=null;if(previous===undefined)delete process.env.AUTH_APP_URL;else process.env.AUTH_APP_URL=previous;await projectDb.close();}
});

const {renameWorkspaceProject,deleteWorkspaceProject}=require('../src/server/workspace-projects.ts');
const workspaceRoute=require('../src/app/api/workspace-projects/[id]/route.ts');
test('workspace rename and empty-only delete enforce ownership, default protection, and current contents',async()=>{
 projectDb=new PGlite();currentUser='owner';
 try{
  await projectDb.exec(`CREATE TABLE workspace_projects(id text primary key,user_id text,name text,is_default boolean default false,updated_at timestamptz default now());CREATE TABLE projects(id text primary key,workspace_project_id text REFERENCES workspace_projects(id) ON DELETE SET NULL);CREATE TABLE scenes(id text primary key,workspace_project_id text REFERENCES workspace_projects(id) ON DELETE CASCADE);INSERT INTO workspace_projects(id,user_id,name,is_default) VALUES('default','owner','My Project',true),('empty','owner','Empty',false),('designs','owner','Designs',false),('scenes','owner','Scenes',false),('foreign','stranger','Private',false);INSERT INTO projects VALUES('box','designs');INSERT INTO scenes VALUES('scene','scenes');`);
  assert.equal(await renameWorkspaceProject('stranger','empty','Hacked'),null);
  await assert.rejects(renameWorkspaceProject('owner','empty','   '),/Enter a project name/);
  assert.equal((await renameWorkspaceProject('owner','empty','  Renamed  ')).name,'Renamed');
  assert.equal(await deleteWorkspaceProject('stranger','empty'),null);
  assert.equal(await deleteWorkspaceProject('owner','missing'),null);
  await assert.rejects(deleteWorkspaceProject('owner','default'),/cannot be deleted/);
  for(const id of ['designs','scenes'])await assert.rejects(deleteWorkspaceProject('owner',id),/Only empty projects/);
  const request=()=>new Request('https://app.example/api/workspace-projects/designs',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({destinationProjectId:'empty'})});
  const blocked=await workspaceRoute.DELETE(request(),{params:Promise.resolve({id:'designs'})});
  assert.equal(blocked.status,400);assert.match((await blocked.json()).error,/Only empty projects/);
  assert.equal((await projectDb.query('SELECT workspace_project_id FROM projects')).rows[0].workspace_project_id,'designs');
  assert.equal((await projectDb.query('SELECT workspace_project_id FROM scenes')).rows[0].workspace_project_id,'scenes');
  currentUser=null;assert.equal((await workspaceRoute.DELETE(request(),{params:Promise.resolve({id:'empty'})})).status,401);
  currentUser='owner';assert.equal((await workspaceRoute.DELETE(request(),{params:Promise.resolve({id:'foreign'})})).status,404);
  const deleted=await workspaceRoute.DELETE(request(),{params:Promise.resolve({id:'empty'})});
  assert.equal(deleted.status,200);assert.deepEqual(await deleted.json(),{deleted:true});
  assert.equal((await projectDb.query("SELECT id FROM workspace_projects WHERE id='empty'")).rows.length,0);
 }finally{await projectDb.close();currentUser='owner';}
});

const {CLAIM_UNVERIFIED_ACCOUNT_SQL}=require('../src/server/auth/users.ts');
test('Google claiming an unverified account removes the squatter password, sessions and tokens',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE TABLE users(id text primary key,email text,name text,password_hash text,email_verified_at timestamptz,created_at timestamptz default now(),signup_method text);CREATE TABLE sessions(token text,user_id text);CREATE TABLE password_reset_tokens(token text,user_id text);CREATE TABLE email_verification_tokens(token text,user_id text);
 INSERT INTO users(id,email,password_hash,email_verified_at) VALUES('squat','victim@example.com','attacker-hash',NULL),('owned','owner@example.com','owner-hash',NOW());
 INSERT INTO sessions VALUES('attacker-session','squat'),('owner-session','owned');INSERT INTO password_reset_tokens VALUES('r','squat');INSERT INTO email_verification_tokens VALUES('v','squat');`);
 const claimed=(await db.query(CLAIM_UNVERIFIED_ACCOUNT_SQL,['squat'])).rows;
 assert.equal(claimed.length,1);assert.equal(claimed[0].password_hash,null);assert.ok(claimed[0].email_verified_at);
 assert.deepEqual((await db.query('SELECT token FROM sessions')).rows,[{token:'owner-session'}]);
 assert.equal((await db.query('SELECT * FROM password_reset_tokens')).rows.length,0);
 assert.equal((await db.query('SELECT * FROM email_verification_tokens')).rows.length,0);
 assert.equal((await db.query(CLAIM_UNVERIFIED_ACCOUNT_SQL,['owned'])).rows.length,0,'verified accounts keep their password and sessions');
 assert.equal((await db.query("SELECT password_hash FROM users WHERE id='owned'")).rows[0].password_hash,'owner-hash');
 }finally{await db.close();}
});
