import { Pool,neonConfig } from '@neondatabase/serverless';
import { assetSyncConfig,destinationKeyForLegacyAsset } from './legacy-asset-sync.mjs';
import { legacyDesignToStudioProject } from '../src/lib/legacy-design-converter.ts';

neonConfig.webSocketConstructor=WebSocket;
const targetUrl=process.env.DATABASE_URL?.trim();
if(!targetUrl)throw new Error('DATABASE_URL is required');
const apply=process.argv.includes('--apply');
if(process.argv.slice(2).some(arg=>!['--apply','--dry-run'].includes(arg)))throw new Error('Supported options: --dry-run or --apply');
if(apply&&process.argv.includes('--dry-run'))throw new Error('Choose --apply or --dry-run');
const assetConfig=assetSyncConfig(process.env);

function record(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function sourceKey(entry){const item=record(entry);return typeof item.s3Key==='string'?item.s3Key:typeof item.s3_key==='string'?item.s3_key:'';}
function mapStorageKey(key){
 return destinationKeyForLegacyAsset(key,assetConfig.sourcePrefix,assetConfig.targetPrefix,assetConfig.targetSubprefix);
}
function mediaByFaceForShare(id,payload){
 const images=record(payload.images),out={};
 for(const [faceId,value] of Object.entries(images)){
  const item=record(value),key=sourceKey(item);if(!key)continue;
  out[faceId]={
   id:`legacy-share-${faceId}`,
   name:typeof item.name==='string'&&item.name?item.name:`${faceId}-artwork`,
   url:`/api/shares/${encodeURIComponent(id)}/legacy-media/${encodeURIComponent(faceId)}`,
   mimeType:typeof item.mime==='string'&&item.mime?item.mime:'image/png',
   byteSize:0,width:null,height:null,fingerprint:key,createdAt:0,
  };
 }
 return out;
}
function legacyAssets(payload){
 const images=record(payload.images),out={};
 for(const [faceId,value] of Object.entries(images)){
  const item=record(value),key=sourceKey(item);if(!key)continue;
  out[faceId]={storageKey:mapStorageKey(key),mime:typeof item.mime==='string'?item.mime:'image/png',name:typeof item.name==='string'?item.name:`${faceId}-artwork`};
 }
 return out;
}
function enrichPayload(payloadValue){
 const payload=structuredClone(record(payloadValue)),images=record(payload.images);
 payload.images=Object.fromEntries(Object.entries(images).map(([faceId,value])=>{
  const item={...record(value)},key=sourceKey(item);
  if(key)item.v2StorageKey=mapStorageKey(key);
  return [faceId,item];
 }));
 if(typeof payload.og_image_key==='string'&&payload.og_image_key){
  payload.v2_og_image_key=mapStorageKey(payload.og_image_key);
 }
 return payload;
}

const pool=new Pool({connectionString:targetUrl});
let db;
try{
 db=await pool.connect();
 const rows=(await db.query("SELECT source,source_id,payload FROM legacy_records WHERE entity_type='shared_designs' AND deleted_at IS NULL ORDER BY source_id")).rows;
 const seenIds=new Set(),seenPreview=new Set();
 const report={shares:rows.length,wouldMigrate:0,migrated:0,anonymous:0,withArtwork:0};
 if(apply)await db.query('BEGIN');
 if(apply){
  await db.query(`CREATE TABLE IF NOT EXISTS design_shares (
   id TEXT PRIMARY KEY,project_id TEXT,user_id TEXT,name TEXT NOT NULL,studio_state JSONB NOT NULL,
   preview_token TEXT,legacy_assets JSONB NOT NULL DEFAULT '{}'::jsonb,legacy_source BOOLEAN NOT NULL DEFAULT FALSE,
   expires_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   revoked_at TIMESTAMPTZ,view_count BIGINT NOT NULL DEFAULT 0
  )`);
  await db.query('ALTER TABLE design_shares ALTER COLUMN user_id DROP NOT NULL');
  await db.query('ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS preview_token TEXT');
  await db.query("ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS legacy_assets JSONB NOT NULL DEFAULT '{}'::jsonb");
  await db.query('ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS legacy_source BOOLEAN NOT NULL DEFAULT FALSE');
  await db.query('ALTER TABLE design_shares ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ');
 }
 for(const row of rows){
  const payload=record(row.payload),id=row.source_id,preview=typeof payload.preview_token==='string'?payload.preview_token:null;
  if(seenIds.has(id))throw new Error(`Duplicate legacy share id: ${id}`);seenIds.add(id);
  if(preview){if(seenPreview.has(preview))throw new Error(`Duplicate legacy preview token: ${preview}`);seenPreview.add(preview);}
  const assets=legacyAssets(payload),media=mediaByFaceForShare(id,payload);
  if(Object.keys(assets).length)report.withArtwork++;
  const converted=legacyDesignToStudioProject({source:row.source,sourceId:id,payload,mediaByFace:media});
  if(!converted)throw new Error(`Could not convert legacy share ${id}`);
  let userId=typeof payload.user_id==='string'&&payload.user_id?payload.user_id:null;
  if(userId){
   const exists=(await db.query('SELECT 1 FROM users WHERE id=$1 LIMIT 1',[userId])).rowCount;
   if(!exists)userId=null;
  }
  if(!userId)report.anonymous++;
  report.wouldMigrate++;
  if(!apply)continue;
  const enriched=enrichPayload(payload);
  await db.query(`INSERT INTO design_shares(
   id,project_id,user_id,name,studio_state,preview_token,legacy_assets,legacy_source,expires_at,created_at,updated_at,view_count
  ) VALUES($1,NULL,$2,$3,$4::jsonb,$5,$6::jsonb,TRUE,$7,COALESCE($8,NOW()),COALESCE($9,NOW()),COALESCE($10,0))
  ON CONFLICT(id) DO UPDATE SET
   user_id=EXCLUDED.user_id,name=EXCLUDED.name,studio_state=EXCLUDED.studio_state,preview_token=EXCLUDED.preview_token,
   legacy_assets=EXCLUDED.legacy_assets,legacy_source=TRUE,expires_at=EXCLUDED.expires_at,updated_at=EXCLUDED.updated_at,
   view_count=GREATEST(design_shares.view_count,EXCLUDED.view_count)`,
   [id,userId,converted.name,JSON.stringify(converted.state),preview,JSON.stringify(assets),payload.expires_at??null,payload.created_at??null,payload.updated_at??null,payload.view_count??0]);
  await db.query("UPDATE legacy_records SET payload=$1::jsonb WHERE source=$2 AND entity_type='shared_designs' AND source_id=$3",[JSON.stringify(enriched),row.source,id]);
  report.migrated++;
 }
 if(apply){
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_design_shares_preview_token ON design_shares(preview_token) WHERE preview_token IS NOT NULL');
  await db.query('COMMIT');
 }
 console.log(JSON.stringify({...report,status:apply?'completed':'dry-run'},null,2));
}catch(error){
 if(apply&&db)await db.query('ROLLBACK').catch(()=>{});
 console.error(error instanceof Error?error.message:String(error));
 process.exitCode=1;
}finally{
 db?.release();await pool.end();
}
