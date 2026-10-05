import { createHash, randomUUID } from 'node:crypto';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ensureV2Schema, getSql } from '@/server/db';
import { optionalEnv, requireEnv } from '@/server/env';
import { ArtworkUploadError, HEIC_UPLOAD_MESSAGE, MAX_ARTWORK_BYTES, inferArtworkMimeType, isAllowedArtworkType, isHeicArtwork } from '@/lib/artwork-upload';

export const MAX_MEDIA_BYTES = MAX_ARTWORK_BYTES;
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Resolve the effective MIME type (extension fallback for empty types) and reject unsupported artwork. */
function resolveMediaType(name:string,mimeType:string){
  if(isHeicArtwork(name,mimeType)) throw new ArtworkUploadError(HEIC_UPLOAD_MESSAGE,'heic');
  const resolved=inferArtworkMimeType(name,mimeType);
  if(!isAllowedArtworkType(resolved)) throw new ArtworkUploadError('Use PNG, JPG, WebP or SVG artwork.','unsupported_type');
  return resolved;
}

function checkMediaSize(byteSize:number){
  if(!Number.isFinite(byteSize)||byteSize<=0) throw new ArtworkUploadError('The selected image is empty.','empty');
  if(byteSize>MAX_MEDIA_BYTES) throw new ArtworkUploadError('Artwork must be 100 MB or smaller.','too_large');
}

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

async function findAssetByFingerprint(userId:string,fingerprint:string,excludeId?:string):Promise<MediaAssetRow|null>{
  await ensureV2Schema();
  const rows=await getSql()`
    SELECT id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint,created_at
    FROM media_assets
    WHERE user_id=${userId} AND fingerprint=${fingerprint} AND id<>${excludeId??''}
    ORDER BY created_at DESC
    LIMIT 1
  ` as MediaAssetRow[];
  return rows[0]??null;
}

async function sha256OfStoredObject(storageKey:string){
  const object=await s3().send(new GetObjectCommand({Bucket:bucket(),Key:storageKey}));
  if(!object.Body) throw new Error('Uploaded artwork could not be read.');
  const hash=createHash('sha256');
  const reader=object.Body.transformToWebStream().getReader();
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    hash.update(value);
  }
  return hash.digest('hex');
}

export type PreparedMediaUpload=
  | {id:string;key:string;uploadUrl:string;maxBytes:number;mimeType:string}
  | {existing:true;asset:MediaAssetDto};

export async function createMediaUpload(userId:string,input:{name:string;mimeType:string;byteSize:number;width?:number|null;height?:number|null;fingerprint?:string|null}):Promise<PreparedMediaUpload>{
  const mimeType=resolveMediaType(input.name,input.mimeType);
  checkMediaSize(input.byteSize);

  // Optional client-computed SHA-256: when this user already has identical
  // artwork, hand it back instead of uploading a second copy. Finalize still
  // verifies the stored bytes, so a wrong hint can only skip a user's own upload.
  const hint=typeof input.fingerprint==='string'?input.fingerprint.toLowerCase():'';
  if(SHA256_HEX.test(hint)){
    const existing=await findAssetByFingerprint(userId,hint);
    if(existing)return {existing:true,asset:toDto(existing)};
  }

  const id=randomUUID();
  const configuredPrefix=optionalEnv('AWS_S3_PREFIX','v2/uploads/').replace(/^\/+|\/+$/g,'');
  const prefix=configuredPrefix ? configuredPrefix+'/' : '';
  const key=`${prefix}users/${userId}/artwork/${id}/${safeFilename(input.name)}`;
  const uploadUrl=await getSignedUrl(s3(),new PutObjectCommand({
    Bucket:bucket(),
    Key:key,
    ContentType:mimeType,
    CacheControl:'private, max-age=3600',
    Metadata:{userId,assetId:id},
  }),{expiresIn:15*60});
  return {id,key,uploadUrl,maxBytes:MAX_MEDIA_BYTES,mimeType};
}

export async function finalizeMediaUpload(userId:string,input:{id:string;key:string;name:string;mimeType:string;byteSize:number;width?:number|null;height?:number|null}):Promise<{asset:MediaAssetDto;existing:boolean}>{
  const mimeType=resolveMediaType(input.name,input.mimeType);
  const configuredPrefix=optionalEnv('AWS_S3_PREFIX','v2/uploads/').replace(/^\/+|\/+$/g,'');
  const expectedPrefix=`${configuredPrefix ? configuredPrefix+'/' : ''}users/${userId}/artwork/${input.id}/`;
  if(!input.key.startsWith(expectedPrefix)) throw new Error('Invalid upload key.');

  const head=await s3().send(new HeadObjectCommand({Bucket:bucket(),Key:input.key}));
  const actualSize=Number(head.ContentLength||0);
  const actualType=head.ContentType||mimeType;
  if(actualSize<=0||actualSize>MAX_MEDIA_BYTES||actualType!==mimeType){
    await s3().send(new DeleteObjectCommand({Bucket:bucket(),Key:input.key})).catch(()=>{});
    if(actualSize>MAX_MEDIA_BYTES) throw new ArtworkUploadError('Artwork must be 100 MB or smaller.','too_large');
    throw new Error('Uploaded artwork could not be verified.');
  }

  // Same fingerprint scheme as uploadMediaAsset (SHA-256 of the stored bytes),
  // computed from the object itself so it cannot be spoofed by the client.
  const fingerprint=await sha256OfStoredObject(input.key);
  const duplicate=await findAssetByFingerprint(userId,fingerprint,input.id);
  if(duplicate){
    if(duplicate.storage_key!==input.key){
      await s3().send(new DeleteObjectCommand({Bucket:bucket(),Key:input.key})).catch(error=>{
        console.warn('duplicate media object cleanup failed',{key:input.key,error:error instanceof Error?error.message:String(error)});
      });
    }
    return {asset:toDto(duplicate),existing:true};
  }

  await ensureV2Schema();
  const rows=await getSql()`
    INSERT INTO media_assets(id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint)
    VALUES(
      ${input.id},${userId},${input.name.slice(0,255)},${mimeType},${actualSize},
      ${Number.isFinite(input.width)?Math.max(1,Math.round(Number(input.width))):null},
      ${Number.isFinite(input.height)?Math.max(1,Math.round(Number(input.height))):null},
      ${input.key},${fingerprint}
    )
    ON CONFLICT (id) DO UPDATE SET
      name=EXCLUDED.name,mime_type=EXCLUDED.mime_type,byte_size=EXCLUDED.byte_size,
      width=EXCLUDED.width,height=EXCLUDED.height,storage_key=EXCLUDED.storage_key,fingerprint=EXCLUDED.fingerprint
    WHERE media_assets.user_id=${userId}
    RETURNING id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint,created_at
  ` as MediaAssetRow[];
  if(!rows[0]) throw new Error('Could not finalize artwork upload.');
  return {asset:toDto(rows[0]),existing:false};
}

export async function uploadMediaAsset(userId:string,file:File,input:{width?:number|null;height?:number|null}={}):Promise<MediaAssetDto>{
  const mimeType=resolveMediaType(file.name,file.type);
  checkMediaSize(file.size);

  const bytes=Buffer.from(await file.arrayBuffer());
  const fingerprint=createHash('sha256').update(bytes).digest('hex');
  await ensureV2Schema();
  const sql=getSql();

  const existing=await findAssetByFingerprint(userId,fingerprint);
  if(existing) return toDto(existing);

  const id=randomUUID();
  const configuredPrefix=optionalEnv('AWS_S3_PREFIX','v2/uploads/').replace(/^\/+|\/+$/g,'');
  const prefix=configuredPrefix ? configuredPrefix+'/' : '';
  const key=`${prefix}users/${userId}/artwork/${id}/${safeFilename(file.name)}`;
  await s3().send(new PutObjectCommand({
    Bucket:bucket(),
    Key:key,
    Body:bytes,
    ContentType:mimeType,
    CacheControl:'private, max-age=3600',
    Metadata:{userId,assetId:id},
  }));

  try{
    const rows=await sql`
      INSERT INTO media_assets(id,user_id,name,mime_type,byte_size,width,height,storage_key,fingerprint)
      VALUES(
        ${id},${userId},${file.name.slice(0,255)},${mimeType},${file.size},
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
