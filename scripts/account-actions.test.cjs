/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const load=Module._load,resolve=Module._resolveFilename;
let projectDb,currentUser='owner';
const sql=async(strings,...params)=>(await projectDb.query(strings.reduce((out,part,i)=>out+part+(i<params.length?'$'+(i+1):''),''),params)).rows;
sql.query=async(query,params)=>(await projectDb.query(query,params)).rows;
Module._load=function(request,...args){if(request==='@/server/db')return {ensureV2Schema:async()=>{},getSql:()=>sql};if(request==='./db')return {ensureV2Schema:async()=>{},getSql:()=>sql};if(request==='@/server/auth/session')return {getCurrentUser:async()=>currentUser?{id:currentUser}:null};if(request==='@/server/auth/action-request')return {guardAuthAction:()=>null};if(request==='@/server/email/mailer')return {sendEmail:async()=>{throw Error('unexpected email call');}};return load.call(this,request,...args);};
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {RESET_PASSWORD_SQL,VERIFY_EMAIL_SQL,tokenDigest}=require('../src/server/auth/email-actions.ts');
const {isValidEmail,cleanName}=require('../src/server/auth/validation.ts');
const {safeReturnTo}=require('../src/lib/auth-navigation.ts');
const {validProjectState}=require('../src/lib/studio-project.ts');
test('valid emails and names work; return URLs stay on the site',()=>{
 assert.equal(isValidEmail('kashan@example.com'),true);assert.equal(isValidEmail('bad email@example.com'),false);assert.equal(isValidEmail('a@b'),false);assert.equal(cleanName(' A   Name '),'A Name');
 for(const next of ['https://evil.example','//evil.example','/\\evil.example','/login?next=/accounts'])assert.equal(safeReturnTo(next),'/studio');
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
 await projectDb.exec(`CREATE TABLE projects(id text primary key,user_id text,name text,studio_state jsonb,preview_image_key text,created_at timestamptz default now(),updated_at timestamptz default now());CREATE TABLE legacy_records(source text,entity_type text,source_id text,payload jsonb,deleted_at timestamptz);`);
 const state={version:1,templateId:'reverse-tuck-carton',dimensions:{width:120,height:180,depth:55,thickness:.5},material:'Kraft',opening:100,measurementUnit:'mm',artworkByPanel:{},outsideArtworkLayers:[],insideArtworkLayers:[],mediaAssets:[],outsideColorMode:'material',insideColorMode:'material',outsideCustomColor:'#ffffff',insideCustomColor:'#ffffff'};
 const request=(body)=>new Request('https://app.example/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const body={name:'My box',state,preview:'data:image/png;base64,abc'};
 currentUser='owner';const first=await saveProject(request(body));assert.equal(first.status,200);const {project}=await first.json();
 assert.equal((await getStudioProject('owner',project.id)).state.dimensions.width,120);assert.equal(await getStudioProject('stranger',project.id),null);
 currentUser='stranger';assert.equal((await saveProject(request({...body,updatedAt:project.updated_at}),project.id)).status,409);assert.equal((await getWorkspaceDesigns('stranger')).total,0);
 currentUser='owner';const changed=await saveProject(request({...body,name:'Updated box',updatedAt:project.updated_at}),project.id);assert.equal(changed.status,200);
 assert.equal((await saveProject(request({...body,updatedAt:project.updated_at}),project.id)).status,409);
 assert.equal((await getWorkspaceDesigns('owner')).designs[0].name,'Updated box');
 currentUser=null;assert.equal((await saveProject(request(body))).status,401);
 }finally{await projectDb.close();currentUser='owner';}
});
