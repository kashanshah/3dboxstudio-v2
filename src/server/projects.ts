import { ensureV2Schema,getSql } from './db';
import type { SavedStudioProject } from '@/lib/studio-project';
import { validProjectState } from '@/lib/studio-project';
export type WorkspaceDesign={id:string;name:string;updatedAt:string;preview:string|null;legacy:boolean;href:string|null};
function legacyPreview(key:string|null){if(!key)return null;const base=process.env.LEGACY_ASSET_BASE_URL?.trim();if(!base)return null;try{const url=new URL(base);if(url.protocol!=='https:')return null;return url.toString().replace(/\/$/,'')+'/'+key.split('/').map(encodeURIComponent).join('/');}catch{return null;}}
function legacyLink(id:string){const base=process.env.LEGACY_SITE_URL?.trim();if(!base)return null;try{const url=new URL(base);if(url.protocol!=='https:')return null;return new URL(`/studio/${encodeURIComponent(id)}`,url).toString();}catch{return null;}}
export async function getWorkspaceDesigns(userId:string,search='',sort='recent',page=1){
 await ensureV2Schema();const sql=getSql(),offset=(page-1)*24;
 const rows=await sql`WITH designs AS (
 SELECT id,name,updated_at,preview_image_key,false AS legacy FROM projects WHERE user_id=${userId}
 UNION ALL SELECT source||':'||source_id AS id,COALESCE(payload->>'name','Untitled legacy design') AS name,COALESCE((payload->>'updated_at')::timestamptz,(payload->>'created_at')::timestamptz) AS updated_at,payload->>'og_image_key' AS preview_image_key,true AS legacy FROM legacy_records WHERE entity_type='shared_designs' AND deleted_at IS NULL AND payload->>'user_id'=${userId}
 ) SELECT *,COUNT(*) OVER()::int AS total FROM designs WHERE strpos(lower(name),lower(${search}))>0 ORDER BY CASE WHEN ${sort}='name' THEN lower(name) END ASC,updated_at DESC,id ASC LIMIT 24 OFFSET ${offset}` as {id:string;name:string;updated_at:string;preview_image_key:string|null;legacy:boolean;total:number}[];
 return {designs:rows.map(row=>({id:row.id,name:row.name,updatedAt:row.updated_at,legacy:row.legacy,preview:row.legacy?legacyPreview(row.preview_image_key):row.preview_image_key,href:row.legacy?legacyLink(row.id.slice(row.id.indexOf(':')+1)):`/studio/editor?project=${encodeURIComponent(row.id)}`} satisfies WorkspaceDesign)),total:rows[0]?.total??0};
}
export async function getStudioProject(userId:string,id:string):Promise<SavedStudioProject|null>{await ensureV2Schema();const rows=await getSql()`SELECT id,name,studio_state,updated_at FROM projects WHERE id=${id} AND user_id=${userId} LIMIT 1` as {id:string;name:string;studio_state:unknown;updated_at:string}[];const row=rows[0];return row&&validProjectState(row.studio_state)?{id:row.id,name:row.name,state:row.studio_state,updatedAt:row.updated_at}:null;}
