import { randomBytes } from 'node:crypto';
import { ensureV2Schema,getSql } from '@/server/db';
import { validProjectState,type StudioProjectState } from '@/lib/studio-project';
import { legacyDesignToStudioProject } from '@/lib/legacy-design-converter';
import { decodeRouteParam } from '@/lib/route-params';
import { ensureLegacyStoredObject } from '@/server/media-assets';

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

export type LegacyShareRow={source:string;source_id:string;payload:unknown};

function jsonRecord(value:unknown):Record<string,unknown>{
 return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}

function legacyMediaByFace(shareId:string,payloadValue:unknown){
 const payload=jsonRecord(payloadValue),images=jsonRecord(payload.images);
 return Object.fromEntries(Object.entries(images).flatMap(([faceId,value])=>{
  const entry=jsonRecord(value);
  const storageKey=typeof entry.v2StorageKey==='string'?entry.v2StorageKey:'';
  const sourceKey=typeof entry.s3Key==='string'?entry.s3Key:typeof entry.s3_key==='string'?entry.s3_key:'';
  if(!storageKey&&!sourceKey)return [];
  const name=typeof entry.name==='string'&&entry.name?entry.name:`${faceId}-artwork`;
  const mime=typeof entry.mime==='string'&&entry.mime?entry.mime:'image/png';
  return [[faceId,{
   id:`legacy-share-${faceId}`,
   name,
   url:`/api/shares/${encodeURIComponent(shareId)}/legacy-media/${encodeURIComponent(faceId)}`,
   mimeType:mime,
   byteSize:0,
   width:null,
   height:null,
   fingerprint:storageKey||sourceKey,
   createdAt:0,
  }]];
 }));
}

function legacyRowToPublicShare(row:LegacyShareRow):PublicShare|null{
 const converted=legacyDesignToStudioProject({
  source:row.source,
  sourceId:row.source_id,
  payload:row.payload,
  mediaByFace:legacyMediaByFace(row.source_id,row.payload),
 });
 if(!converted||!validProjectState(converted.state))return null;
 return {
  id:row.source_id,
  name:converted.name,
  state:converted.state,
  legacy:true,
  updatedAt:converted.updatedAt,
 };
}

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

type ShareRow={id:string;name:string;studio_state:unknown;legacy_source:boolean;updated_at:string;user_id:string|null;legacy_assets:unknown;active:boolean};
type Sql=ReturnType<typeof getSql>;

function legacyPreviewToken(payload:unknown){
 const value=jsonRecord(payload).preview_token;
 return typeof value==='string'&&value?value:null;
}

function legacyAssetsFromPayload(payload:unknown){
 const images=jsonRecord(jsonRecord(payload).images);
 return Object.fromEntries(Object.entries(images).flatMap(([faceId,value])=>{
  const entry=jsonRecord(value);
  if(typeof entry.v2StorageKey!=='string'||!entry.v2StorageKey)return [];
  return [[faceId,{storageKey:entry.v2StorageKey,mime:typeof entry.mime==='string'&&entry.mime?entry.mime:'image/png',name:typeof entry.name==='string'&&entry.name?entry.name:`${faceId}-artwork`}]];
 }));
}

function validTimestamp(value:unknown){
 return typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
}

async function findShareRows(sql:Sql,where:{id?:string|null;previewToken?:string|null}){
 // Rows matching the share id or the preview token, id match first. Revoked
 // and expired rows are returned too so callers can refuse to fall back to
 // legacy_records for a share its owner revoked.
 return await sql`
  SELECT id,name,studio_state,legacy_source,updated_at,user_id,legacy_assets,
         (revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW())) AS active
  FROM design_shares
  WHERE id=${where.id??null} OR (${where.previewToken??null}::text IS NOT NULL AND preview_token=${where.previewToken??null})
  ORDER BY CASE WHEN id=${where.id??null} THEN 0 ELSE 1 END
 ` as ShareRow[];
}

async function legacyOwnerUserId(sql:Sql,payload:unknown){
 // The legacy user sync preserves V1 user ids as V2 users.id, so the mirrored
 // payload.user_id is the owner whenever that user exists in V2.
 const userId=jsonRecord(payload).user_id;
 if(typeof userId!=='string'||!userId)return null;
 const rows=await sql`SELECT id FROM users WHERE id=${userId} LIMIT 1` as {id:string}[];
 return rows[0]?.id??null;
}

/**
 * Legacy V1 shares live on V2 as design_shares rows. Resolve (or create) the
 * row for a mirrored legacy_records share so revocation, view counts and
 * ownership all go through the normal V2 path. Returns the row whatever its
 * revocation state; callers must check `active`.
 */
export async function ensureLegacyShareRow(sql:Sql,legacy:LegacyShareRow):Promise<ShareRow|null>{
 const previewToken=legacyPreviewToken(legacy.payload);
 const existing=(await findShareRows(sql,{id:legacy.source_id,previewToken}))[0];
 if(existing){
  if(!existing.user_id){
   const owner=await legacyOwnerUserId(sql,legacy.payload);
   if(owner){
    await sql`UPDATE design_shares SET user_id=${owner} WHERE id=${existing.id} AND user_id IS NULL`;
    existing.user_id=owner;
   }
  }
  return existing;
 }
 if(!SHARE_TOKEN_RE.test(legacy.source_id))return null;
 const converted=legacyRowToPublicShare(legacy);
 if(!converted)return null;
 const payload=jsonRecord(legacy.payload);
 const owner=await legacyOwnerUserId(sql,legacy.payload);
 const views=Number(payload.view_count);
 const viewCount=Number.isSafeInteger(views)&&views>0?views:0;
 await sql`
  INSERT INTO design_shares(id,project_id,user_id,name,studio_state,preview_token,legacy_assets,legacy_source,expires_at,created_at,updated_at,view_count)
  VALUES(${legacy.source_id},NULL,${owner},${converted.name},${JSON.stringify(converted.state)}::jsonb,${previewToken},${JSON.stringify(legacyAssetsFromPayload(legacy.payload))}::jsonb,TRUE,
         ${validTimestamp(payload.expires_at)}::timestamptz,COALESCE(${validTimestamp(payload.created_at)}::timestamptz,NOW()),COALESCE(${validTimestamp(payload.updated_at)}::timestamptz,NOW()),${viewCount})
  ON CONFLICT DO NOTHING
 `;
 return (await findShareRows(sql,{id:legacy.source_id,previewToken}))[0]??null;
}

function publicShareFromRow(row:ShareRow):PublicShare|null{
 if(!row.active||!validProjectState(row.studio_state))return null;
 return {id:row.id,name:row.name,state:rewriteMediaUrls(row.studio_state,row.id),legacy:row.legacy_source,updatedAt:row.updated_at};
}

async function activeLegacyShareRecord(sql:Sql,where:{sourceId?:string;previewToken?:string;ownerId?:string}){
 const rows=await sql`
  SELECT source,source_id,payload
  FROM legacy_records
  WHERE entity_type='shared_designs'
    AND deleted_at IS NULL
    AND (${where.sourceId??null}::text IS NULL OR source_id=${where.sourceId??null})
    AND (${where.previewToken??null}::text IS NULL OR payload->>'preview_token'=${where.previewToken??null})
    AND (${where.ownerId??null}::text IS NULL OR payload->>'user_id'=${where.ownerId??null})
  LIMIT 1
 ` as LegacyShareRow[];
 return rows[0]??null;
}

export async function revokeDesignShare(userId:string,id:string){
 await ensureV2Schema();
 const sql=getSql();
 let targetId=id;
 const existing=await sql`SELECT id FROM design_shares WHERE id=${id} LIMIT 1` as {id:string}[];
 if(!existing[0]&&SHARE_TOKEN_RE.test(id)){
  // A V1 share never resolved on V2 yet: materialize it so the revocation is
  // recorded on design_shares and blocks the legacy fallback.
  const legacy=await activeLegacyShareRecord(sql,{sourceId:id,ownerId:userId});
  const row=legacy?await ensureLegacyShareRow(sql,legacy):null;
  if(row)targetId=row.id;
 }
 // Migrated V1 share rows can have user_id NULL. Claim them for the user that
 // owns the mirrored legacy record so the normal ownership check applies.
 await sql`
  UPDATE design_shares ds SET user_id=${userId}
  WHERE ds.id=${targetId} AND ds.user_id IS NULL AND ds.legacy_source=TRUE
    AND EXISTS (
     SELECT 1 FROM legacy_records lr
     WHERE lr.entity_type='shared_designs'
       AND lr.payload->>'user_id'=${userId}
       AND (lr.source_id=ds.id OR (ds.preview_token IS NOT NULL AND lr.payload->>'preview_token'=ds.preview_token))
    )
 `;
 const rows=await sql`
  UPDATE design_shares SET revoked_at=NOW(),updated_at=NOW()
  WHERE id=${targetId} AND user_id=${userId} AND revoked_at IS NULL
  RETURNING id
 ` as {id:string}[];
 return Boolean(rows[0]);
}

export async function getPublicShare(id:string,countView=true):Promise<PublicShare|null>{
 if(!SHARE_TOKEN_RE.test(id))return null;
 await ensureV2Schema();
 const sql=getSql();
 let row:ShareRow|null=(await findShareRows(sql,{id}))[0]??null;

 // Original V1 /studio/<shareId> links: resolve through the mirrored
 // legacy_records share and serve the V2 design_shares row for it (created on
 // first use; it may be an older migrated row keyed by the preserved preview
 // token). An existing revoked row is final and never falls back to V1 data.
 if(!row){
  const legacy=await activeLegacyShareRecord(sql,{sourceId:id});
  if(legacy)row=await ensureLegacyShareRow(sql,legacy);
 }
 if(!row)return null;
 const share=publicShareFromRow(row);
 if(share&&countView)await sql`UPDATE design_shares SET view_count=view_count+1 WHERE id=${row.id}`;
 return share;
}

export async function getPreviewShare(previewToken:string):Promise<PublicShare|null>{
 if(!SHARE_TOKEN_RE.test(previewToken))return null;
 await ensureV2Schema();
 const sql=getSql();
 let row:ShareRow|null=(await findShareRows(sql,{previewToken}))[0]??null;
 if(!row){
  const legacy=await activeLegacyShareRecord(sql,{previewToken});
  if(legacy)row=await ensureLegacyShareRow(sql,legacy);
 }
 return row?publicShareFromRow(row):null;
}

export async function getMigratedShareAsset(id:string,faceId:string){
 if(!SHARE_TOKEN_RE.test(id)||!/^[A-Za-z][A-Za-z0-9]*$/.test(faceId))return null;
 await ensureV2Schema();
 const sql=getSql();
 let row:ShareRow|null=(await findShareRows(sql,{id}))[0]??null;
 const legacy=await activeLegacyShareRecord(sql,{sourceId:id});
 if(!row&&legacy)row=await ensureLegacyShareRow(sql,legacy);
 // Never serve artwork for a revoked, expired or unknown share.
 if(!row||!row.active)return null;
 const migrated=jsonRecord(jsonRecord(row.legacy_assets)[faceId]);
 if(typeof migrated.storageKey==='string'&&migrated.storageKey){
  return {
   storageKey:migrated.storageKey,
   mime:typeof migrated.mime==='string'&&migrated.mime?migrated.mime:'image/png',
   name:typeof migrated.name==='string'&&migrated.name?migrated.name:`${faceId}-artwork`,
  };
 }

 // The share row predates legacy_assets enrichment. Read the mirrored record;
 // migrate-legacy-shares stores the copied V2 object key as v2StorageKey.
 if(!legacy)return null;
 const payload=jsonRecord(legacy.payload);
 const images=jsonRecord(payload.images);
 const entry=jsonRecord(images[faceId]);
 let storageKey=typeof entry.v2StorageKey==='string'?entry.v2StorageKey:'';

 // If this mirrored record predates the v2StorageKey enrichment, repair it
 // once by copying the original legacy object into the normal V2 namespace.
 if(!storageKey){
  const sourceKey=typeof entry.s3Key==='string'?entry.s3Key:typeof entry.s3_key==='string'?entry.s3_key:'';
  if(!sourceKey)return null;
  storageKey=await ensureLegacyStoredObject(sourceKey);

  const nextEntry={...entry,v2StorageKey:storageKey};
  const nextPayload={...payload,images:{...images,[faceId]:nextEntry}};
  await sql`
   UPDATE legacy_records
   SET payload=${JSON.stringify(nextPayload)}::jsonb
   WHERE source=${legacy.source}
     AND entity_type='shared_designs'
     AND source_id=${legacy.source_id}
  `;
 }

 return {
  storageKey,
  mime:typeof entry.mime==='string'&&entry.mime?entry.mime:'image/png',
  name:typeof entry.name==='string'&&entry.name?entry.name:`${faceId}-artwork`,
 };
}

/**
 * A legacy design was saved as a V2 project: move its V1 share link onto that
 * project. The existing design_shares row (by legacy share id, or by the
 * preserved preview token) is re-pointed at the project and refreshed with the
 * saved state; otherwise a row is created under the legacy share id so old
 * /studio/<id> and /preview/<token> URLs keep working. A revoked row stays
 * revoked.
 */
export async function moveLegacyShareToProject(sql:Sql,legacy:LegacyShareRow,userId:string,project:{id:string;name:string;state:StudioProjectState}){
 const previewToken=legacyPreviewToken(legacy.payload);
 const name=project.name.trim().slice(0,120)||'Untitled design';
 const existing=(await findShareRows(sql,{id:legacy.source_id,previewToken}))[0];
 if(existing){
  if(!existing.active)return null;
  if(existing.user_id&&existing.user_id!==userId)return null;
  await sql`
   UPDATE design_shares
   SET project_id=${project.id},user_id=${userId},name=${name},studio_state=${JSON.stringify(project.state)}::jsonb,legacy_source=FALSE,updated_at=NOW()
   WHERE id=${existing.id} AND revoked_at IS NULL
  `;
  return existing.id;
 }
 if(!SHARE_TOKEN_RE.test(legacy.source_id))return null;
 const rows=await sql`
  INSERT INTO design_shares(id,project_id,user_id,name,studio_state,preview_token,legacy_assets,legacy_source)
  VALUES(${legacy.source_id},${project.id},${userId},${name},${JSON.stringify(project.state)}::jsonb,${previewToken},${JSON.stringify(legacyAssetsFromPayload(legacy.payload))}::jsonb,FALSE)
  ON CONFLICT DO NOTHING
  RETURNING id
 ` as {id:string}[];
 return rows[0]?.id??null;
}

/** Revoke every V2 share row that serves a deleted legacy design. */
export async function revokeLegacyShares(sql:Sql,legacy:LegacyShareRow,userId:string){
 const previewToken=legacyPreviewToken(legacy.payload);
 await sql`
  UPDATE design_shares
  SET revoked_at=NOW(),updated_at=NOW(),user_id=COALESCE(user_id,${userId})
  WHERE revoked_at IS NULL
    AND (id=${legacy.source_id} OR (${previewToken}::text IS NOT NULL AND preview_token=${previewToken}))
 `;
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


export async function getLegacyDesignThumbnail(id:string){
 await ensureV2Schema();
 const designId=decodeRouteParam(id);
 const rows=await getSql()`
  SELECT payload->>'v2_og_image_key' AS storage_key
  FROM legacy_records
  WHERE source||':'||source_id=${designId}
    AND entity_type='shared_designs'
    AND deleted_at IS NULL
  LIMIT 1
 ` as {storage_key:string|null}[];
 const storageKey=rows[0]?.storage_key;
 return storageKey?{storageKey}:null;
}
