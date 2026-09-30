/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const originalLoad=Module._load,originalResolve=Module._resolveFilename;
let db;
const sql=async(strings,...params)=> (await db.query(strings.reduce((s,part,i)=>s+part+(i<params.length?'$'+(i+1):''),''),params)).rows;
sql.query=async(query,params)=>(await db.query(query,params)).rows;
Module._load=function(request,...args){if(request==='@/server/db')return {ensureV2Schema:async()=>{},getSql:()=>sql};if(request==='./storage-stats')return {getStorageStats:async()=>({available:false,prefix:'v2/test/',objects:0,bytes:0})};return originalLoad.call(this,request,...args);};
Module._resolveFilename=function(request,...args){return originalResolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {getDashboard}=require('../src/server/admin/dashboard.ts');
const {LEGACY_SYNC_SCHEMA}=require('../src/server/legacy-schema.ts');
test('dashboard SQL includes synced and native records and filters every design metric consistently',async()=>{
 db=new PGlite();
 try{
 await db.exec(LEGACY_SYNC_SCHEMA);
 await db.exec(`CREATE TABLE users(id text,created_at timestamptz default now(),email_verified_at timestamptz,utm_source text,signup_method text,signup_landing_type text,signup_conversion_page text);CREATE TABLE projects(id text,user_id text,created_at timestamptz default now(),preview_image_key text,studio_state jsonb);CREATE TABLE contact_submissions(id text,created_at timestamptz default now(),status text);CREATE TABLE media_assets(id text,byte_size bigint);INSERT INTO users(id,signup_method,email_verified_at) VALUES('u1','google',NOW());INSERT INTO projects(id,user_id,studio_state) VALUES('p1','u1','{"artworkByPanel":{"Front":{}}}'),('p2','u1','{}');`);
 const now=new Date().toISOString();
 for(const [id,images,views]of [['d1',{front:'key'},10],['d2',{},50]])await db.query("INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash) VALUES('v1','shared_designs',$1,$2,'x')",[id,JSON.stringify({id,created_at:now,images,view_count:views})]);
 const filtered=await getDashboard('daily',false);assert.equal(filtered.metrics.designs.total,2);assert.equal(filtered.metrics.designs.views,10);assert.equal(filtered.metrics.designs.last30,2);assert.equal(filtered.metrics.images.faces,2);assert.equal(filtered.metrics.designActivity.reduce((s,r)=>s+Number(r.count),0),2);
 const all=await getDashboard('daily',true);assert.equal(all.metrics.designs.total,4);assert.equal(all.metrics.designs.views,60);assert.equal(all.metrics.designActivity.reduce((s,r)=>s+Number(r.count),0),4);
 for(const period of ['weekly','monthly','quarterly','yearly']){const result=await getDashboard(period,false);assert.ok(result.spine.some(day=>result.metrics.designActivity.some(row=>row.date===day.date)));}
 }finally{await db.close();}
});
