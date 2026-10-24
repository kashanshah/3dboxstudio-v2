/* eslint-disable @typescript-eslint/no-require-imports */
// Client share links (Pro): the owner's name and logo, and an optional
// password. Settings are checked, only the owner can change them, the right
// password unlocks the share and its images, and changing it locks them again.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
let db;
const sql=async(strings,...params)=>(await db.query(strings.reduce((out,part,i)=>out+part+(i<params.length?'$'+(i+1):''),''),params)).rows;
sql.query=async(query,params)=>(await db.query(query,params)).rows;
const load=Module._load;
Module._load=function(request,...args){if(request==='@/server/db')return {ensureV2Schema:async()=>{},getSql:()=>sql};return load.call(this,request,...args);};
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const shares=require('../src/server/client-shares.ts');
const {getShareMedia,getPublicShare,getPreviewShare}=require('../src/server/design-shares.ts');

const state={version:1,templateId:'reverse-tuck-carton',dimensions:{width:120,height:180,depth:55,thickness:.5},material:'Kraft',opening:100,measurementUnit:'mm',artworkByPanel:{},outsideArtworkLayers:[],insideArtworkLayers:[],mediaAssets:[],outsideColorMode:'material',insideColorMode:'material',outsideCustomColor:'#ffffff',insideCustomColor:'#ffffff'};

test('settings are checked: a short name, a logo id, and a password of 4 to 128 characters',()=>{
  const ok=shares.parseShareSettings({brandName:'  Acme   Packaging ',logoAssetId:'logo-1'});
  assert.deepEqual(ok,{ok:true,value:{brandName:'Acme Packaging',logoAssetId:'logo-1',password:undefined}});
  assert.equal(shares.parseShareSettings({brandName:'x'.repeat(61)}).ok,false);
  assert.equal(shares.parseShareSettings({logoAssetId:'../etc'}).ok,false);
  assert.equal(shares.parseShareSettings({password:'abc'}).ok,false);
  assert.equal(shares.parseShareSettings({password:'x'.repeat(129)}).ok,false);
  assert.equal(shares.parseShareSettings({password:''}).value.password,null);
  assert.equal(shares.parseShareSettings({password:'open sesame'}).value.password,'open sesame');
});

test('an unlock cookie only opens the share it was made for, under its current password',()=>{
  assert.equal(shares.isShareUnlocked('abcdefghij',null,undefined),true);
  const value=shares.unlockCookieValue('abcdefghij','salt:hash1');
  assert.equal(shares.isShareUnlocked('abcdefghij','salt:hash1',value),true);
  assert.equal(shares.isShareUnlocked('abcdefghij','salt:hash1',undefined),false);
  assert.equal(shares.isShareUnlocked('abcdefghij','salt:hash2',value),false);
  assert.equal(shares.isShareUnlocked('klmnopqrst','salt:hash1',value),false);
});

test('PostgreSQL: only the owner sets a brand and password; the password guards the page, its images and preview links',async()=>{
  db=new PGlite();
  try{
    await db.exec(`CREATE TABLE design_shares(id TEXT PRIMARY KEY,project_id TEXT,user_id TEXT,name TEXT NOT NULL,studio_state JSONB NOT NULL,preview_token TEXT,legacy_assets JSONB NOT NULL DEFAULT '{}',legacy_source BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW(),revoked_at TIMESTAMPTZ,view_count BIGINT NOT NULL DEFAULT 0,brand_name TEXT,brand_logo_asset_id TEXT,password_hash TEXT);
      CREATE TABLE media_assets(id TEXT PRIMARY KEY,user_id TEXT,name TEXT,mime_type TEXT,storage_key TEXT);
      CREATE TABLE legacy_records(source TEXT,source_id TEXT,entity_type TEXT,payload JSONB);
      INSERT INTO media_assets VALUES('logo-1','owner','logo.png','image/png','k1'),('doc-1','owner','brief.pdf','application/pdf','k2'),('theirs','stranger','x.png','image/png','k3');`);
    await db.query(`INSERT INTO design_shares(id,user_id,name,studio_state,preview_token) VALUES('Share12345','owner','Candle box',$1,'Preview1234')`,[JSON.stringify(state)]);
    const value=shares.parseShareSettings({brandName:'Acme',logoAssetId:'logo-1',password:'open sesame'}).value;
    assert.equal(await shares.updateShareSettings('stranger','Share12345',value),null);
    await assert.rejects(shares.updateShareSettings('owner','Share12345',{...value,logoAssetId:'theirs'}),shares.ShareSettingsError);
    await assert.rejects(shares.updateShareSettings('owner','Share12345',{...value,logoAssetId:'doc-1'}),shares.ShareSettingsError);
    assert.deepEqual(await shares.updateShareSettings('owner','Share12345',value),{brandName:'Acme',logoAssetId:'logo-1',hasPassword:true});

    const share=await getPublicShare('Share12345',false);
    assert.deepEqual(share.brand,{name:'Acme',logoUrl:'/api/shares/Share12345/media/logo-1'});
    assert.ok(share.passwordHash);
    assert.equal(await getPreviewShare('Preview1234'),null,'preview links cannot ask for a password');
    assert.equal((await getShareMedia('Share12345','logo-1')).password_hash,share.passwordHash,'the logo is served, behind the password');

    assert.equal(await shares.unlockShare('Share12345','wrong'),null);
    const cookie=await shares.unlockShare('Share12345','open sesame');
    assert.equal(shares.isShareUnlocked('Share12345',share.passwordHash,cookie),true);

    // Saving without a password keeps it; a new password locks out old visits; '' removes it.
    assert.equal((await shares.updateShareSettings('owner','Share12345',{...value,password:undefined})).hasPassword,true);
    await shares.updateShareSettings('owner','Share12345',{...value,password:'new secret'});
    const changed=(await getPublicShare('Share12345',false)).passwordHash;
    assert.equal(shares.isShareUnlocked('Share12345',changed,cookie),false);
    assert.equal((await shares.updateShareSettings('owner','Share12345',{...value,password:null})).hasPassword,false);
    assert.ok(await getPreviewShare('Preview1234'));
  }finally{await db.close();}
});
