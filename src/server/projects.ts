import { ensureV2Schema,getSql } from './db';
import type { SavedStudioProject } from '@/lib/studio-project';
import { validProjectState } from '@/lib/studio-project';
import { legacyDesignToStudioProject } from '@/lib/legacy-design-converter';
import { decodeRouteParam } from '@/lib/route-params';
import { ensureLegacyMediaForDesign } from '@/server/legacy-media';

export type WorkspaceDesign={id:string;name:string;updatedAt:string;preview:string|null;legacy:boolean;href:string|null;favorite:boolean;workspaceProjectId:string|null};

export function cleanDesignName(value:unknown){
 if(typeof value!=='string')return null;
 const name=value.trim();
 return name&&name.length<=120?name:null;
}

// Renames only touch the name: the revision stays put so an editor tab open on
// this design can keep saving without a conflict (see saveProject's baseName).
export async function renameDesign(userId:string,id:string,name:string){
 await ensureV2Schema();
 const rows=await getSql()`UPDATE projects SET name=${name},updated_at=NOW() WHERE id=${id} AND user_id=${userId} RETURNING id,name,revision` as {id:string;name:string;revision:number}[];
 return rows[0]??null;
}

export async function getWorkspaceDesigns(userId:string,search='',sort='recent',page=1,workspaceProjectId?:string|null){
 await ensureV2Schema();const sql=getSql(),offset=(page-1)*24;
 const rows=await sql`WITH designs AS (
 SELECT id,name,updated_at,preview_image_key,false AS legacy,is_favorite,workspace_project_id
 FROM projects
 WHERE user_id=${userId}
   AND (${workspaceProjectId??null}::text IS NULL OR workspace_project_id=${workspaceProjectId??null})
 UNION ALL
 SELECT lr.source||':'||lr.source_id AS id,
        COALESCE(lr.payload->>'name','Untitled legacy design') AS name,
        COALESCE((lr.payload->>'updated_at')::timestamptz,(lr.payload->>'created_at')::timestamptz) AS updated_at,
        lr.payload->>'v2_og_image_key' AS preview_image_key,
        true AS legacy,
        false AS is_favorite,
        NULL::text AS workspace_project_id
 FROM legacy_records lr
 WHERE lr.entity_type='shared_designs'
   AND lr.deleted_at IS NULL
   AND lr.payload->>'user_id'=${userId}
   AND ${workspaceProjectId??null}::text IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM projects p
     WHERE p.user_id=${userId}
       AND p.studio_state->>'legacySourceId'=lr.source||':'||lr.source_id
   )
 ) SELECT *,COUNT(*) OVER()::int AS total
 FROM designs
 WHERE strpos(lower(name),lower(${search}))>0
 ORDER BY CASE WHEN ${sort}='name' THEN lower(name) END ASC,updated_at DESC,id ASC
 LIMIT 24 OFFSET ${offset}` as {id:string;name:string;updated_at:string;preview_image_key:string|null;legacy:boolean;is_favorite:boolean;workspace_project_id:string|null;total:number}[];
 return {
  designs:rows.map(row=>({
   id:row.id,
   name:row.name,
   updatedAt:row.updated_at,
   legacy:row.legacy,
   preview:row.legacy?(row.preview_image_key?`/api/legacy-designs/${encodeURIComponent(row.id)}/thumbnail`:null):row.preview_image_key,
   href:`/studio/editor?project=${encodeURIComponent(row.id)}`,
   favorite:row.is_favorite,
   workspaceProjectId:row.workspace_project_id,
  } satisfies WorkspaceDesign)),
  total:rows[0]?.total??0,
 };
}

export async function getStudioProject(userId:string,id:string):Promise<SavedStudioProject|null>{
 await ensureV2Schema();const sql=getSql();
 const projectId=decodeRouteParam(id);
 const rows=await sql`SELECT id,name,studio_state,updated_at,is_favorite,revision,workspace_project_id FROM projects WHERE id=${projectId} AND user_id=${userId} LIMIT 1` as {id:string;name:string;studio_state:unknown;updated_at:string;is_favorite:boolean;revision:number;workspace_project_id:string|null}[];
 const row=rows[0];
 if(row&&validProjectState(row.studio_state))return {
  id:row.id,name:row.name,state:row.studio_state,updatedAt:row.updated_at,favorite:row.is_favorite,revision:row.revision,workspaceProjectId:row.workspace_project_id,
 };

 const legacyRows=await sql`SELECT source,source_id,payload FROM legacy_records WHERE source||':'||source_id=${projectId} AND entity_type='shared_designs' AND deleted_at IS NULL AND payload->>'user_id'=${userId} LIMIT 1` as {source:string;source_id:string;payload:unknown}[];
 const legacy=legacyRows[0];
 if(!legacy)return null;
 const mediaByFace=await ensureLegacyMediaForDesign(userId,legacy.payload);
 const converted=legacyDesignToStudioProject({source:legacy.source,sourceId:legacy.source_id,payload:legacy.payload,mediaByFace});
 return converted?{...converted,workspaceProjectId:null}:null;
}
