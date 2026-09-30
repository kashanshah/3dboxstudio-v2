import { randomBytes } from 'node:crypto';
import { ensureV2Schema,getSql } from '@/server/db';
import { validProjectState,type StudioProjectState } from '@/lib/studio-project';
import { legacyDesignToStudioProject } from '@/lib/legacy-design-converter';
import type { LocalMediaAsset } from '@/lib/packaging/artwork';

const SHARE_TOKEN_RE=/^[0-9A-Za-z]{10,24}$/;
function createShareId(){return randomBytes(12).toString('base64url').replace(/[-_]/g,'').slice(0,14);}
type JsonRecord=Record<string,unknown>;
function record(value:unknown):JsonRecord{return value&&typeof value==='object'&&!Array.isArray(value)?value as JsonRecord:{};}
function legacyProxyMedia(payloadValue:unknown,urlForFace:(faceId:string)=>string):Record<string,LocalMediaAsset>{
 const payload=record(payloadValue),images=record(payload.images),out:Record<string,LocalMediaAsset>={};
 for(const [faceId,value] of Object.entries(images)){
  const item=record(value);
  const key=typeof item.s3Key==='string'?item.s3Key:typeof item.s3_key==='string'?item.s3_key:'';
  if(!key)continue;
  out[faceId]={
   id:`legacy-share-${faceId}`,
   name:typeof item.name==='string'&&item.name?item.name:`${faceId}-artwork`,
   url:urlForFace(faceId),
   mimeType:typeof item.mime==='string'&&item.mime?item.mime:'image/png',
   byteSize:0,width:null,height:null,fingerprint:key,createdAt:0,
  };
 }
 return out;
}

function rewriteMediaUrls(state:StudioProjectState,shareId:string):StudioProjectState{
 const rewrite=(url:string,assetId?:string)=>assetId&&url.startsWith('/api/media/')?`/api/shares/${encodeURIComponent(shareId)}/media/${encodeURIComponent(assetId)}`:url;
 return {
  ...state,
  artworkByPanel:Object.fromEntries(Object.entries(state.artworkByPanel).map(([key,item])=>[key,{...item,url:rewrite(item.url,item.assetId)}])),
  outsideArtworkLayers:state.outsideArtworkLayers.map(item=>({...item,url:rewrite(item.url,item.assetId)})),
  insideArtworkLayers:state.insideArtworkLayers.map(item=>({...item,url:rewrite(item.url,item.assetId)})),
  mediaAssets:state.mediaAssets.map(item=>({...item,url:rewrite(item.url,item.id)})),
 };
}

export type PublicShare={id:string;name:string;state:StudioProjectState;legacy:boolean;updatedAt:string|null};

export async function upsertDesignShare(userId:string,input:{projectId?:string|null;name:string;state:unknown}){
 await ensureV2Schema();
 if(!validProjectState(input.state))throw new Error('Invalid design state.');
 const name=input.name.trim().slice(0,120)||'Untitled design';
 const sql=getSql();
 if(input.projectId){
  const owned=await sql`SELECT id FROM projects WHERE id=${input.projectId} AND user_id=${userId} LIMIT 1` as {id:string}[];
  if(!owned[0])throw new Error('Save this design before sharing it.');
  const existing=await sql`
   SELECT id FROM design_shares
   WHERE project_id=${input.projectId} AND user_id=${userId} AND revoked_at IS NULL
   LIMIT 1
  ` as {id:string}[];
  if(existing[0]){
   const rows=await sql`
    UPDATE design_shares SET name=${name},studio_state=${JSON.stringify(input.state)}::jsonb,updated_at=NOW()
    WHERE id=${existing[0].id} AND user_id=${userId}
    RETURNING id,updated_at
   ` as {id:string;updated_at:string}[];
   return rows[0];
  }
 }
 let id=createShareId();
 for(let attempt=0;attempt<5;attempt++){
  const exists=await sql`SELECT 1 FROM design_shares WHERE id=${id} LIMIT 1` as unknown[];
  if(!exists.length)break;
  id=createShareId();
 }
 const rows=await sql`
  INSERT INTO design_shares(id,project_id,user_id,name,studio_state)
  VALUES(${id},${input.projectId??null},${userId},${name},${JSON.stringify(input.state)}::jsonb)
  RETURNING id,updated_at
 ` as {id:string;updated_at:string}[];
 return rows[0];
}

export async function revokeDesignShare(userId:string,id:string){
 await ensureV2Schema();
 const rows=await getSql()`UPDATE design_shares SET revoked_at=NOW(),updated_at=NOW() WHERE id=${id} AND user_id=${userId} AND revoked_at IS NULL RETURNING id` as {id:string}[];
 return Boolean(rows[0]);
}

export async function getPublicShare(id:string,countView=true):Promise<PublicShare|null>{
 if(!SHARE_TOKEN_RE.test(id))return null;
 await ensureV2Schema();
 const sql=getSql();
 const native=countView
  ? await sql`
      UPDATE design_shares SET view_count=view_count+1
      WHERE id=${id} AND revoked_at IS NULL
      RETURNING id,name,studio_state,updated_at
    ` as {id:string;name:string;studio_state:unknown;updated_at:string}[]
  : await sql`
      SELECT id,name,studio_state,updated_at FROM design_shares
      WHERE id=${id} AND revoked_at IS NULL
      LIMIT 1
    ` as {id:string;name:string;studio_state:unknown;updated_at:string}[];
 if(native[0]&&validProjectState(native[0].studio_state))return {
  id:native[0].id,name:native[0].name,state:rewriteMediaUrls(native[0].studio_state,id),legacy:false,updatedAt:native[0].updated_at,
 };

 const legacyRows=await sql`
  SELECT source,source_id,payload
  FROM legacy_records
  WHERE entity_type='shared_designs' AND source_id=${id} AND deleted_at IS NULL
  LIMIT 1
 ` as {source:string;source_id:string;payload:unknown}[];
 const legacy=legacyRows[0];
 if(!legacy)return null;
 const mediaByFace=legacyProxyMedia(legacy.payload,faceId=>`/api/legacy-shares/${encodeURIComponent(id)}/images/${encodeURIComponent(faceId)}`);
 const converted=legacyDesignToStudioProject({source:legacy.source,sourceId:legacy.source_id,payload:legacy.payload,mediaByFace});
 if(!converted)return null;
 return {id,name:converted.name,state:converted.state,legacy:true,updatedAt:converted.updatedAt};
}

export async function getLegacyPreviewShare(previewToken:string):Promise<PublicShare|null>{
 if(!SHARE_TOKEN_RE.test(previewToken))return null;
 await ensureV2Schema();
 const rows=await getSql()`
  SELECT source,source_id,payload
  FROM legacy_records
  WHERE entity_type='shared_designs' AND payload->>'preview_token'=${previewToken} AND deleted_at IS NULL
  LIMIT 1
 ` as {source:string;source_id:string;payload:unknown}[];
 const legacy=rows[0];
 if(!legacy)return null;
 const mediaByFace=legacyProxyMedia(legacy.payload,faceId=>`/api/legacy-shares/preview/${encodeURIComponent(previewToken)}/images/${encodeURIComponent(faceId)}`);
 const converted=legacyDesignToStudioProject({source:legacy.source,sourceId:legacy.source_id,payload:legacy.payload,mediaByFace});
 return converted?{id:previewToken,name:converted.name,state:converted.state,legacy:true,updatedAt:converted.updatedAt}:null;
}

export async function getLegacyShareImageById(id:string,faceId:string){
 if(!SHARE_TOKEN_RE.test(id)||!/^[A-Za-z][A-Za-z0-9]*$/.test(faceId))return null;
 await ensureV2Schema();
 const rows=await getSql()`
  SELECT payload FROM legacy_records
  WHERE entity_type='shared_designs' AND source_id=${id} AND deleted_at IS NULL
  LIMIT 1
 ` as {payload:unknown}[];
 const payload=record(rows[0]?.payload),entry=record(record(payload.images)[faceId]);
 const storageKey=typeof entry.s3Key==='string'?entry.s3Key:typeof entry.s3_key==='string'?entry.s3_key:'';
 if(!storageKey)return null;
 return {storageKey,mime:typeof entry.mime==='string'?entry.mime:'image/png',name:typeof entry.name==='string'?entry.name:`${faceId}-artwork`};
}

export async function getLegacyShareImageByPreview(previewToken:string,faceId:string){
 if(!SHARE_TOKEN_RE.test(previewToken)||!/^[A-Za-z][A-Za-z0-9]*$/.test(faceId))return null;
 await ensureV2Schema();
 const rows=await getSql()`
  SELECT payload FROM legacy_records
  WHERE entity_type='shared_designs' AND payload->>'preview_token'=${previewToken} AND deleted_at IS NULL
  LIMIT 1
 ` as {payload:unknown}[];
 const payload=record(rows[0]?.payload),entry=record(record(payload.images)[faceId]);
 const storageKey=typeof entry.s3Key==='string'?entry.s3Key:typeof entry.s3_key==='string'?entry.s3_key:'';
 if(!storageKey)return null;
 return {storageKey,mime:typeof entry.mime==='string'?entry.mime:'image/png',name:typeof entry.name==='string'?entry.name:`${faceId}-artwork`};
}

export async function getShareMedia(id:string,assetId:string){
 if(!SHARE_TOKEN_RE.test(id)||!/^[A-Za-z0-9-]+$/.test(assetId))return null;
 await ensureV2Schema();
 const sql=getSql();
 const rows=await sql`
  SELECT ds.user_id,ds.studio_state,ma.storage_key,ma.mime_type,ma.name
  FROM design_shares ds
  JOIN media_assets ma ON ma.user_id=ds.user_id AND ma.id=${assetId}
  WHERE ds.id=${id} AND ds.revoked_at IS NULL
  LIMIT 1
 ` as {user_id:string;studio_state:unknown;storage_key:string;mime_type:string;name:string}[];
 const row=rows[0];
 if(!row||!validProjectState(row.studio_state))return null;
 const ids=new Set([
  ...row.studio_state.mediaAssets.map(item=>item.id),
  ...Object.values(row.studio_state.artworkByPanel).map(item=>item.assetId).filter(Boolean),
  ...row.studio_state.outsideArtworkLayers.map(item=>item.assetId).filter(Boolean),
  ...row.studio_state.insideArtworkLayers.map(item=>item.assetId).filter(Boolean),
 ]);
 return ids.has(assetId)?row:null;
}
