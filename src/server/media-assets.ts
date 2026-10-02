import { createHash, randomUUID } from 'node:crypto';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ensureV2Schema, getSql } from '@/server/db';
import { optionalEnv, requireEnv } from '@/server/env';

export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
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

export async function createMediaUpload(userId:string,input:{name:string;mimeType:string;byteSize:number;width?:number|null;height?:number|null}){
  if(!ALLOWED_MEDIA_TYPES.has(input.mimeType)) throw new Error('Use PNG, JPG, WebP or SVG artwork.');
  if(!Number.isFinite(input.byteSize)||input.byteSize<=0) throw new Error('The selected image is empty.');
  if(input.byteSize>MAX_MEDIA_BYTES) throw new Error('Artwork must be 100 MB or smaller.');

  const id=randomUUID();
  const configuredPrefix=optionalEnv('AWS_S3_PREFIX','v2/uploads/').replace(/^\/+|\/+$/g,'');
  const prefix=configuredPrefix ? configuredPrefix+'/' : '';
  const key=`${prefix}users/${userId}/artwork/${id}/${safeFilename(input.name)}`;
  const uploadUrl=await getSignedUrl(s3(),new PutObjectCommand({
    Bucket:bucket(),
    Key:key,
    ContentType:input.mimeType,
    CacheControl:'private, max-age=3600',
    Metadata:{userId,assetId:id},
  }),{expiresIn:15*60});
  return {id,key,uploadUrl,maxBytes:MAX_MEDIA_BYTES};
}

export async function finalizeMediaUpload(userId:string,input:{id:string;key:string;name:string;mimeType:string;byteSize:number;width?:number|null;height?:number|null}):Promise<MediaAssetDto>{
  if(!ALLOWED_MEDIA_TYPES.has(input.mimeType)) throw new Error('Unsupported artwork type.');
  const configuredPrefix=optionalEnv('AWS_S3_PREFIX','v2/uploads/').replace(/^\/+|\/+$/g,'');
  const expectedPrefix=`${configuredPrefix ? configuredPrefix+'/' : ''}users/${userId}/artwork/${input.id}/`;
  if(!input.key.startsWith(expectedPrefix)) throw new Error('Invalid upload key.');

  const head=await s3().send(new HeadObjectCommand({Bucket:bucket(),Key:input.key}));
  const actualSize=Number(head.ContentLength||0);
  const actualType=head.ContentType||input.mimeType;
  if(actualSize<=0||actualSize>MAX_MEDIA_BYTES||actualType!==input.mimeType){
    await s3().send(new DeleteObjectCommand({Bucket:bucket(),Key:input.key})).catch(()=>{});
    throw new Error(actualSize>MAX_MEDIA_BYTES?'Artwork must be 100 MB or smaller.':'Uploaded artwork could not be verified.');
  }

  await ensureV2Schema();
  const rows=await getSql()`
    INSERT INTO media_assets(id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint)
    VALUES(
      ${input.id},${userId},${input.name.slice(0,255)},${input.mimeType},${actualSize},
      ${Number.isFinite(input.width)?Math.max(1,Math.round(Number(input.width))):null},
      ${Number.isFinite(input.height)?Math.max(1,Math.round(Number(input.height))):null},
      ${input.key},${input.id}
    )
    ON CONFLICT (id) DO UPDATE SET
      name=EXCLUDED.name,mime_type=EXCLUDED.mime_type,byte_size=EXCLUDED.byte_size,
      width=EXCLUDED.width,height=EXCLUDED.height,storage_key=EXCLUDED.storage_key
    WHERE media_assets.user_id=${userId}
    RETURNING id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint,created_at
  ` as MediaAssetRow[];
  if(!rows[0]) throw new Error('Could not finalize artwork upload.');
  return toDto(rows[0]);
}

export async function uploadMediaAsset(userId:string,file:File,input:{width?:number|null;height?:number|null}={}):Promise<MediaAssetDto>{
  if(!ALLOWED_MEDIA_TYPES.has(file.type)) throw new Error('Use PNG, JPG, WebP or SVG artwork.');
  if(file.size<=0) throw new Error('The selected image is empty.');
  if(file.size>MAX_MEDIA_BYTES) throw new Error('Artwork must be 100 MB or smaller.');

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
  const object=await readStoredObject(row.storage_key);
  if(!object)return null;
  return {row,bytes:object.bytes};
}

export async function headStoredObject(storageKey:string){
  const object=await s3().send(new HeadObjectCommand({Bucket:bucket(),Key:storageKey}));
  return {byteSize:Number(object.ContentLength||0),contentType:object.ContentType||null};
}

export async function readStoredObject(storageKey:string){
  const object=await s3().send(new GetObjectCommand({Bucket:bucket(),Key:storageKey}));
  if(!object.Body)return null;
  const bytes=await object.Body.transformToByteArray();
  return {bytes,contentType:object.ContentType||'application/octet-stream'};
}

function normalizePrefix(value:string){
  const trimmed=value.replace(/^\/+/, '');
  return trimmed&&!trimmed.endsWith('/') ? trimmed+'/' : trimmed;
}

function encodeCopySource(bucketName:string,key:string){
  return bucketName+'/'+key.split('/').map(encodeURIComponent).join('/');
}

export async function ensureLegacyStoredObject(sourceKey:string){
  const sourceBucket=optionalEnv('LEGACY_AWS_S3_BUCKET')||bucket();
  const sourcePrefix=normalizePrefix(optionalEnv('LEGACY_AWS_S3_PREFIX')||optionalEnv('AWS_S3_SHARE_PREFIX')||'shares/');
  const targetPrefix=normalizePrefix(optionalEnv('AWS_S3_PREFIX','v2/uploads/'));
  const targetSubprefix=normalizePrefix(optionalEnv('LEGACY_ASSET_TARGET_SUBPREFIX','legacy/'));
  if(!sourceKey.startsWith(sourcePrefix))throw new Error(`Legacy source key is outside configured prefix: ${sourceKey}`);
  const relative=sourceKey.slice(sourcePrefix.length);
  if(!relative)throw new Error('Legacy source key points at the prefix root.');
  const storageKey=`${targetPrefix}${targetSubprefix}${relative}`;

  try{
    await s3().send(new HeadObjectCommand({Bucket:bucket(),Key:storageKey}));
    return storageKey;
  }catch(error){
    const status=(error as {$metadata?:{httpStatusCode?:number}})?.$metadata?.httpStatusCode;
    const name=error instanceof Error?error.name:'';
    if(status!==404&&name!=='NotFound'&&name!=='NoSuchKey')throw error;
  }

  await s3().send(new CopyObjectCommand({
    Bucket:bucket(),
    Key:storageKey,
    CopySource:encodeCopySource(sourceBucket,sourceKey),
    MetadataDirective:'COPY',
  }));
  await s3().send(new HeadObjectCommand({Bucket:bucket(),Key:storageKey}));
  return storageKey;
}

export async function deleteMediaAsset(userId:string,id:string){
  const row=await getMediaAsset(userId,id);
  if(!row)return {deleted:false,reason:'not_found' as const};

  // Saved project state is the source of truth for whether an account image may
  // be physically removed. Return every blocking design so the UI can tell the
  // user exactly where the image must be removed/replaced first.
  const usages=await getSql()`
    SELECT id,name
    FROM projects
    WHERE user_id=${userId}
      AND studio_state::text LIKE ${'%'+id+'%'}
    ORDER BY updated_at DESC,id ASC
  ` as {id:string;name:string}[];
  if(usages.length)return {deleted:false,reason:'in_use' as const,projects:usages};

  try{
    await s3().send(new DeleteObjectCommand({Bucket:bucket(),Key:row.storage_key}));
  }catch(error){
    const status=(error as {$metadata?:{httpStatusCode?:number}})?.$metadata?.httpStatusCode;
    const name=error instanceof Error?error.name:'';
    const message=error instanceof Error?error.message:String(error);

    // Deleting a media-library entry should still succeed if the physical object
    // is already gone. Treat a missing object as an already-completed storage delete.
    if(status!==404&&name!=='NotFound'&&name!=='NoSuchKey'){
      console.error('media object delete failed',{id,storageKey:row.storage_key,status,name,message});
      return {
        deleted:false,
        reason:'storage_error' as const,
        storageError:status===403||name==='AccessDenied'?'access_denied' as const:'delete_failed' as const,
      };
    }
  }

  await getSql()`DELETE FROM media_assets WHERE id=${id} AND user_id=${userId}`;
  return {deleted:true as const};
}

// Used by the durable admin deletion queue after its database transaction commits.
export async function deleteStoredObject(storageKey: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: storageKey }));
}
