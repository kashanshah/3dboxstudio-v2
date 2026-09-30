import { createHash } from 'node:crypto';
import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSql } from '@/server/db';
import { headStoredObject, readStoredObject, type MediaAssetDto } from '@/server/media-assets';

type JsonRecord=Record<string,unknown>;
function record(value:unknown):JsonRecord{return value&&typeof value==='object'&&!Array.isArray(value)?value as JsonRecord:{};}
function normalizePrefix(value:string|undefined,fallback=''){
 const trimmed=String(value||fallback).replace(/^\/+/, '');
 return trimmed&& !trimmed.endsWith('/')?trimmed+'/':trimmed;
}
function targetKey(sourceKey:string){
 const sourcePrefix=normalizePrefix(process.env.LEGACY_AWS_S3_PREFIX||process.env.AWS_S3_SHARE_PREFIX,'shares/');
 const targetPrefix=normalizePrefix(process.env.AWS_S3_PREFIX,'v2/uploads/');
 const sub=normalizePrefix(process.env.LEGACY_ASSET_TARGET_SUBPREFIX,'legacy/');
 if(!sourceKey.startsWith(sourcePrefix))throw new Error(`Legacy asset is outside configured prefix: ${sourceKey}`);
 return targetPrefix+sub+sourceKey.slice(sourcePrefix.length);
}
function sourceKey(entry:unknown){
 const item=record(entry);
 return typeof item.s3Key==='string'?item.s3Key:typeof item.s3_key==='string'?item.s3_key:'';
}
function stableId(userId:string,key:string){
 return 'legacy-'+createHash('sha256').update(userId+'\0'+key).digest('hex').slice(0,24);
}
function encodeCopySource(bucket:string,key:string){
 return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
let client:S3Client|null=null;
function legacyS3(){
 if(client)return client;
 const accessKeyId=process.env.AWS_ACCESS_KEY_ID?.trim();
 const secretAccessKey=process.env.AWS_SECRET_ACCESS_KEY?.trim();
 client=new S3Client({
  region:process.env.AWS_REGION?.trim()||'us-east-1',
  ...(accessKeyId&&secretAccessKey?{credentials:{accessKeyId,secretAccessKey}}:{}),
  ...(process.env.AWS_S3_ENDPOINT?.trim()?{endpoint:process.env.AWS_S3_ENDPOINT.trim(),forcePathStyle:process.env.AWS_S3_FORCE_PATH_STYLE==='true'}:{}),
 });
 return client;
}
export async function readLegacyStoredObject(sourceStorageKey:string){
 // Public legacy previews should use the migrated V2 copy first. Production
 // credentials may intentionally be restricted to v2/uploads/* even though
 // the original application can still read shares/*.
 try{
  const migratedKey=targetKey(sourceStorageKey);
  const migrated=await readStoredObject(migratedKey);
  if(migrated)return migrated;
 }catch(error){
  console.warn('migrated legacy artwork read failed; falling back to source',{
   sourceStorageKey,
   error:error instanceof Error?error.message:String(error),
  });
 }

 const sourceBucket=(process.env.LEGACY_AWS_S3_BUCKET||process.env.AWS_S3_BUCKET)?.trim();
 if(!sourceBucket)throw new Error('Legacy S3 bucket is not configured.');
 const object=await legacyS3().send(new GetObjectCommand({Bucket:sourceBucket,Key:sourceStorageKey}));
 if(!object.Body)return null;
 const bytes=await object.Body.transformToByteArray();
 return {bytes,contentType:object.ContentType||'application/octet-stream'};
}

async function ensureCopiedLegacyObject(sourceStorageKey:string,targetStorageKey:string){
 try{return await headStoredObject(targetStorageKey);}catch{}
 const sourceBucket=(process.env.LEGACY_AWS_S3_BUCKET||process.env.AWS_S3_BUCKET)?.trim();
 const targetBucket=process.env.AWS_S3_BUCKET?.trim();
 if(!sourceBucket||!targetBucket)throw new Error('Legacy or target S3 bucket is not configured.');
 const s3=legacyS3();
 const source=await s3.send(new HeadObjectCommand({Bucket:sourceBucket,Key:sourceStorageKey}));
 await s3.send(new CopyObjectCommand({
  Bucket:targetBucket,
  Key:targetStorageKey,
  CopySource:encodeCopySource(sourceBucket,sourceStorageKey),
  MetadataDirective:'COPY',
  ...(source.ETag?{CopySourceIfMatch:source.ETag}:{}),
 }));
 return await headStoredObject(targetStorageKey);
}
export async function ensureLegacyMediaForDesign(userId:string,payloadValue:unknown):Promise<Record<string,MediaAssetDto>>{
 const payload=record(payloadValue),images=record(payload.images),config=record(payload.config),sourceMeta=record(config.sourceImageMeta);
 const sql=getSql(),out:Record<string,MediaAssetDto>={};
 for(const [faceId,entryValue] of Object.entries(images)){
   const entry=record(entryValue),key=sourceKey(entry);if(!key)continue;
   let storageKey;try{storageKey=targetKey(key);}catch{continue;}
   const id=stableId(userId,storageKey);
   let objectMeta;
   try{objectMeta=await ensureCopiedLegacyObject(key,storageKey);}catch(error){
     console.warn('legacy artwork link failed',{faceId,key,storageKey,error:error instanceof Error?error.message:String(error)});
     continue;
   }
   const name=typeof entry.name==='string'&&entry.name?entry.name:`${faceId}-artwork`;
   const mime=objectMeta.contentType || (typeof entry.mime==='string'&&entry.mime?entry.mime:'image/png');
   let width:null|number=null,height:null|number=null;
   const placement=record(record(config.faceImagePlacements)[faceId]);
   const sourceId=typeof placement.sourceImageId==='string'?placement.sourceImageId:'';
   const meta=record(sourceMeta[sourceId]);
   if(Number.isFinite(Number(meta.naturalWidth)))width=Math.max(1,Math.round(Number(meta.naturalWidth)));
   if(Number.isFinite(Number(meta.naturalHeight)))height=Math.max(1,Math.round(Number(meta.naturalHeight)));
   const fingerprint='legacy:'+createHash('sha256').update(storageKey).digest('hex');
   const rows=await sql`
     INSERT INTO media_assets(id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint)
     VALUES(${id},${userId},${name.slice(0,255)},${mime},${objectMeta.byteSize},${width},${height},${storageKey},${fingerprint})
     ON CONFLICT(user_id,storage_key) DO UPDATE SET
       name=EXCLUDED.name,
       mime_type=EXCLUDED.mime_type,
       byte_size=CASE WHEN media_assets.byte_size>0 THEN media_assets.byte_size ELSE EXCLUDED.byte_size END,
       width=COALESCE(media_assets.width,EXCLUDED.width),
       height=COALESCE(media_assets.height,EXCLUDED.height)
     RETURNING id,name,mime_type,byte_size,width,height,fingerprint,created_at
   ` as {id:string;name:string;mime_type:string;byte_size:number|string;width:number|null;height:number|null;fingerprint:string|null;created_at:string}[];
   const row=rows[0];
   out[faceId]={
     id:row.id,name:row.name,url:`/api/media/${encodeURIComponent(row.id)}`,mimeType:row.mime_type,
     byteSize:Number(row.byte_size||0),width:row.width,height:row.height,fingerprint:row.fingerprint||row.id,createdAt:new Date(row.created_at).getTime(),
   };
 }
 return out;
}
