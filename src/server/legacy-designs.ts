import { getSql } from '@/server/db';
import type { StudioProjectState } from '@/lib/studio-project';
import { decodeRouteParam } from '@/lib/route-params';
import { moveLegacyShareToProject,revokeLegacyShares,type LegacyShareRow } from '@/server/design-shares';

// Legacy (V1) designs are mirrored into legacy_records as entity_type
// 'shared_designs' and listed in the Studio library as `<source>:<source_id>`.
// The legacy user sync preserves V1 user ids as V2 users.id, so ownership is
// payload->>'user_id' = the signed-in user's id (the same predicate the library
// listing and getStudioProject use).

// Matches the admin deletion block id. Recording it in admin_deleted_entities
// stops a later legacy sync from un-deleting the record.
function legacyBlockId(row:{source:string;source_id:string}){return `${row.source}:shared_designs:${row.source_id}`;}

/**
 * Soft-delete an owned, still-active legacy design. Returns the record when the
 * caller owned it, null otherwise (unknown id, someone else's, already gone).
 */
async function retireOwnedLegacyDesign(userId:string,legacyId:string,extra:Record<string,unknown>={}){
 const sql=getSql();
 const rows=await sql`
  UPDATE legacy_records
  SET deleted_at=NOW(),payload=payload||${JSON.stringify(extra)}::jsonb
  WHERE source||':'||source_id=${legacyId}
    AND entity_type='shared_designs'
    AND deleted_at IS NULL
    AND payload->>'user_id'=${userId}
  RETURNING source,source_id,payload
 ` as LegacyShareRow[];
 const legacy=rows[0];
 if(!legacy)return null;
 await sql`INSERT INTO admin_deleted_entities(kind,id) VALUES('legacy',${legacyBlockId(legacy)}) ON CONFLICT DO NOTHING`;
 return legacy;
}

/**
 * A legacy design opened in the editor was saved as a new V2 project. Retire
 * the legacy record (so the library shows only the V2 project, even if that
 * project is later deleted) and move its V1 share link onto the project.
 */
export async function adoptLegacyDesign(userId:string,legacySourceId:string,project:{id:string;name:string;state:StudioProjectState}){
 const sql=getSql();
 const owned=await sql`
  SELECT source,source_id,payload FROM legacy_records
  WHERE source||':'||source_id=${legacySourceId}
    AND entity_type='shared_designs'
    AND deleted_at IS NULL
    AND payload->>'user_id'=${userId}
  LIMIT 1
 ` as LegacyShareRow[];
 if(!owned[0])return null;
 // Move the share first so the V1 link never points at a retired record.
 const shareId=await moveLegacyShareToProject(sql,owned[0],userId,project);
 const legacy=await retireOwnedLegacyDesign(userId,legacySourceId,{v2_project_id:project.id,v2_converted_at:new Date().toISOString()});
 if(!legacy)return null;
 return {legacyId:`${legacy.source}:${legacy.source_id}`,shareId};
}

/** Delete a legacy design from the owner's library and stop serving its shares. */
export async function deleteLegacyDesign(userId:string,id:string){
 const legacy=await retireOwnedLegacyDesign(userId,decodeRouteParam(id),{v2_deleted_by_owner_at:new Date().toISOString()});
 if(!legacy)return false;
 await revokeLegacyShares(getSql(),legacy,userId);
 return true;
}
