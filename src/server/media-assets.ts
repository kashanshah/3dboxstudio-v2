import { createHash, randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ensureV2Schema, getSql } from '@/server/db';
import { optionalEnv, requireEnv } from '@/server/env';

const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set(['image/png','image/jpeg','image/webp','image/svg+xml']);

let client: S3Client | null = null;

function s3(){
  if(!client){
    const accessKeyId=optionalEnv('AWS_ACCESS_KEY_ID');
    const secretAccessKey=optionalEnv('AWS_SECRET_ACCESS_KEY');
    client = new S3Client({
      region: requireEnv('AWS_REGION'),
      ...(accessKeyId&&secretAccessKey ? {credentials:{accessKeyId,secretAccessKey}} : {}),
      ...(optionalEnv('AWS_S3_ENDPOINT') ? {
        endpoint: optionalEnv('AWS_S3_ENDPOINT'),
        forcePathStyle: optionalEnv('AWS_S3_FORCE_PATH_STYLE') === 'true',
      } : {}),
    });
  }
  return client;
}

function bucket(){ return requireEnv('AWS_S3_BUCKET'); }
function stableUrl(id:string){ return `/api/media/${encodeURIComponent(id)}`; }
function safeFilename(name:string){
  const cleaned=name.trim().replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
  return cleaned || 'artwork';
}

export type MediaAssetRow={
  id:string;
  user_id:string;
  name:string;
  mime_type:string;
  byte_size:number|string;
  width:number|null;
  height:number|null;
  storage_key:string;
  fingerprint:string|null;
  created_at:string;
};

export type MediaAssetDto={
  id:string;
  name:string;
  url:string;
  mimeType:string;
  byteSize:number;
  width:number|null;
  height:number|null;
  fingerprint:string;
  createdAt:number;
};

function toDto(row:MediaAssetRow):MediaAssetDto{
  return {
    id:row.id,
    name:row.name,
    url:stableUrl(row.id),
    mimeType:row.mime_type,
    byteSize:Number(row.byte_size||0),
    width:row.width,
    height:row.height,
    fingerprint:row.fingerprint || row.id,
    createdAt:new Date(row.created_at).getTime(),
  };
}

export async function listMediaAssets(userId:string):Promise<MediaAssetDto[]>{
  await ensureV2Schema();
  const rows=await getSql()`
    SELECT id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint,created_at
    FROM media_assets
    WHERE user_id=${userId}
    ORDER BY created_at DESC,id DESC
    LIMIT 500
  ` as MediaAssetRow[];
  return rows.map(toDto);
}

export async function uploadMediaAsset(userId:string,file:File,input:{width?:number|null;height?:number|null}={}):Promise<MediaAssetDto>{
  if(!ALLOWED_MEDIA_TYPES.has(file.type)) throw new Error('Use PNG, JPG, WebP or SVG artwork.');
  if(file.size<=0) throw new Error('The selected image is empty.');
  if(file.size>MAX_MEDIA_BYTES) throw new Error('Artwork must be 15 MB or smaller.');

  const bytes=Buffer.from(await file.arrayBuffer());
  const fingerprint=createHash('sha256').update(bytes).digest('hex');
  await ensureV2Schema();
  const sql=getSql();

  const existing=await sql`
    SELECT id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint,created_at
    FROM media_assets
    WHERE user_id=${userId} AND fingerprint=${fingerprint}
    ORDER BY created_at DESC
    LIMIT 1
  ` as MediaAssetRow[];
  if(existing[0]) return toDto(existing[0]);

  const id=randomUUID();
  const configuredPrefix=optionalEnv('AWS_S3_PREFIX','v2/uploads/').replace(/^\/+|\/+$/g,'');
  const prefix=configuredPrefix ? configuredPrefix+'/' : '';
  const key=`${prefix}users/${userId}/artwork/${id}/${safeFilename(file.name)}`;
  await s3().send(new PutObjectCommand({
    Bucket:bucket(),
    Key:key,
    Body:bytes,
    ContentType:file.type,
    CacheControl:'private, max-age=3600',
    Metadata:{userId,assetId:id},
  }));

  try{
    const rows=await sql`
      INSERT INTO media_assets(id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint)
      VALUES(
        ${id},${userId},${file.name.slice(0,255)},${file.type},${file.size},
        ${Number.isFinite(input.width)?Math.max(1,Math.round(Number(input.width))):null},
        ${Number.isFinite(input.height)?Math.max(1,Math.round(Number(input.height))):null},
        ${key},${fingerprint}
      )
      RETURNING id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint,created_at
    ` as MediaAssetRow[];
    return toDto(rows[0]);
  }catch(error){
    await s3().send(new DeleteObjectCommand({Bucket:bucket(),Key:key})).catch(()=>{});
    throw error;
  }
}

export async function getMediaAsset(userId:string,id:string):Promise<MediaAssetRow|null>{
  await ensureV2Schema();
  const rows=await getSql()`
    SELECT id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint,created_at
    FROM media_assets WHERE id=${id} AND user_id=${userId} LIMIT 1
  ` as MediaAssetRow[];
  return rows[0]??null;
}

export async function readMediaAsset(userId:string,id:string){
  const row=await getMediaAsset(userId,id);
  if(!row)return null;
  const object=await s3().send(new GetObjectCommand({Bucket:bucket(),Key:row.storage_key}));
  if(!object.Body)return null;
  const bytes=await object.Body.transformToByteArray();
  return {row,bytes};
}

export async function deleteMediaAsset(userId:string,id:string){
  const row=await getMediaAsset(userId,id);
  if(!row)return {deleted:false,reason:'not_found' as const};

  const used=await getSql()`
    SELECT id,name FROM projects
    WHERE user_id=${userId} AND studio_state::text LIKE ${'%'+id+'%'}
    ORDER BY updated_at DESC
    LIMIT 1
  ` as {id:string;name:string}[];
  if(used[0]) return {deleted:false,reason:'in_use' as const,project:used[0]};

  await s3().send(new DeleteObjectCommand({Bucket:bucket(),Key:row.storage_key}));
  await getSql()`DELETE FROM media_assets WHERE id=${id} AND user_id=${userId}`;
  return {deleted:true as const};
}
