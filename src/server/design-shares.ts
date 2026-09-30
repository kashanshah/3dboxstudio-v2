import { randomBytes } from 'node:crypto';
import { ensureV2Schema,getSql } from '@/server/db';
import { validProjectState,type StudioProjectState } from '@/lib/studio-project';

const SHARE_TOKEN_RE=/^[0-9A-Za-z]{10,24}$/;
function createShareId(){return randomBytes(12).toString('base64url').replace(/[-_]/g,'').slice(0,14);}

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
    UPDATE design_shares
    SET name=${name},studio_state=${JSON.stringify(input.state)}::jsonb,updated_at=NOW()
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
  INSERT INTO design_shares(id,project_id,user_id,name,studio_state,legacy_source)
  VALUES(${id},${input.projectId??null},${userId},${name},${JSON.stringify(input.state)}::jsonb,FALSE)
  RETURNING id,updated_at
 ` as {id:string;updated_at:string}[];
 return rows[0];
}

export async function revokeDesignShare(userId:string,id:string){
 await ensureV2Schema();
 const rows=await getSql()`
  UPDATE design_shares SET revoked_at=NOW(),updated_at=NOW()
  WHERE id=${id} AND user_id=${userId} AND revoked_at IS NULL
  RETURNING id
 ` as {id:string}[];
 return Boolean(rows[0]);
}

export async function getPublicShare(id:string,countView=true):Promise<PublicShare|null>{
 if(!SHARE_TOKEN_RE.test(id))return null;
 await ensureV2Schema();
 const sql=getSql();
 const rows=countView
  ? await sql`
      UPDATE design_shares SET view_count=view_count+1
      WHERE id=${id} AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW())
      RETURNING id,name,studio_state,legacy_source,updated_at
    `
  : await sql`
      SELECT id,name,studio_state,legacy_source,updated_at
      FROM design_shares WHERE id=${id} AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1
    `;
 const row=(rows as {id:string;name:string;studio_state:unknown;legacy_source:boolean;updated_at:string}[])[0];
 if(!row||!validProjectState(row.studio_state))return null;
 return {id:row.id,name:row.name,state:rewriteMediaUrls(row.studio_state,id),legacy:row.legacy_source,updatedAt:row.updated_at};
}

export async function getPreviewShare(previewToken:string):Promise<PublicShare|null>{
 if(!SHARE_TOKEN_RE.test(previewToken))return null;
 await ensureV2Schema();
 const rows=await getSql()`
  SELECT id,name,studio_state,legacy_source,updated_at
  FROM design_shares
  WHERE preview_token=${previewToken} AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW())
  LIMIT 1
 ` as {id:string;name:string;studio_state:unknown;legacy_source:boolean;updated_at:string}[];
 const row=rows[0];
 if(!row||!validProjectState(row.studio_state))return null;
 return {id:row.id,name:row.name,state:rewriteMediaUrls(row.studio_state,row.id),legacy:row.legacy_source,updatedAt:row.updated_at};
}

export async function getMigratedShareAsset(id:string,faceId:string){
 if(!SHARE_TOKEN_RE.test(id)||!/^[A-Za-z][A-Za-z0-9]*$/.test(faceId))return null;
 await ensureV2Schema();
 const rows=await getSql()`
  SELECT legacy_assets FROM design_shares
  WHERE id=${id} AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW()) AND legacy_source=TRUE
  LIMIT 1
 ` as {legacy_assets:Record<string,{storageKey?:string;mime?:string;name?:string}>}[];
 const entry=rows[0]?.legacy_assets?.[faceId];
 return entry?.storageKey?{storageKey:entry.storageKey,mime:entry.mime||'image/png',name:entry.name||`${faceId}-artwork`}:null;
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
