import { createHash } from 'node:crypto';
import { getSql } from '@/server/db';
import { ensureLegacyStoredObject, headStoredObject, type MediaAssetDto } from '@/server/media-assets';

type JsonRecord=Record<string,unknown>;
function record(value:unknown):JsonRecord{return value&&typeof value==='object'&&!Array.isArray(value)?value as JsonRecord:{};}
async function migratedStorageKey(entry:unknown){
 const item=record(entry);
 if(typeof item.v2StorageKey==='string'&&item.v2StorageKey)return item.v2StorageKey;
 // Records mirrored before the v2StorageKey enrichment only carry the V1 key.
 // Copy that object into the V2 namespace so converting the design keeps its
 // artwork instead of silently dropping the face.
 const sourceKey=typeof item.s3Key==='string'?item.s3Key:typeof item.s3_key==='string'?item.s3_key:'';
 if(!sourceKey)return '';
 try{return await ensureLegacyStoredObject(sourceKey);}catch(error){
   console.warn('legacy artwork copy failed',{sourceKey,error:error instanceof Error?error.message:String(error)});
   return '';
 }
}
function stableId(userId:string,key:string){
 return 'legacy-'+createHash('sha256').update(userId+'\0'+key).digest('hex').slice(0,24);
}

export async function ensureLegacyMediaForDesign(userId:string,payloadValue:unknown):Promise<Record<string,MediaAssetDto>>{
 const payload=record(payloadValue),images=record(payload.images),config=record(payload.config),sourceMeta=record(config.sourceImageMeta);
 const sql=getSql(),out:Record<string,MediaAssetDto>={};
 for(const [faceId,entryValue] of Object.entries(images)){
   const entry=record(entryValue),storageKey=await migratedStorageKey(entry);if(!storageKey)continue;
   const id=stableId(userId,storageKey);
   let objectMeta;
   try{objectMeta=await headStoredObject(storageKey);}catch(error){
     console.warn('migrated artwork missing from V2 storage',{faceId,storageKey,error:error instanceof Error?error.message:String(error)});
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
