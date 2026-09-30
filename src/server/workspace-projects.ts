import { randomUUID } from 'node:crypto';
import { ensureV2Schema,getSql } from './db';

export type WorkspaceProject={
  id:string;
  name:string;
  isDefault:boolean;
  designCount:number;
  sceneCount:number;
  updatedAt:string;
  createdAt:string;
};

export async function ensureDefaultWorkspaceProject(userId:string):Promise<string>{
  await ensureV2Schema();
  const sql=getSql();
  const existing=await sql`SELECT id FROM workspace_projects WHERE user_id=${userId} AND is_default=TRUE LIMIT 1` as {id:string}[];
  if(existing[0]?.id)return existing[0].id;
  const id=`default_${randomUUID()}`;
  await sql`
    INSERT INTO workspace_projects(id,user_id,name,is_default)
    VALUES(${id},${userId},'My Project',TRUE)
    ON CONFLICT DO NOTHING
  `;
  const rows=await sql`SELECT id FROM workspace_projects WHERE user_id=${userId} AND is_default=TRUE LIMIT 1` as {id:string}[];
  if(!rows[0]?.id)throw new Error('Could not create the default project.');
  return rows[0].id;
}

export async function resolveWorkspaceProjectId(userId:string,requestedId?:string|null):Promise<string>{
  if(!requestedId)return ensureDefaultWorkspaceProject(userId);
  await ensureV2Schema();
  const rows=await getSql()`SELECT id FROM workspace_projects WHERE id=${requestedId} AND user_id=${userId} LIMIT 1` as {id:string}[];
  return rows[0]?.id??ensureDefaultWorkspaceProject(userId);
}

export async function listWorkspaceProjects(userId:string):Promise<WorkspaceProject[]>{
  await ensureDefaultWorkspaceProject(userId);
  const rows=await getSql()`
    SELECT
      wp.id,wp.name,wp.is_default,wp.created_at,
      GREATEST(
        wp.updated_at,
        COALESCE(MAX(d.updated_at),wp.updated_at),
        COALESCE(MAX(s.updated_at),wp.updated_at)
      ) AS updated_at,
      COUNT(DISTINCT d.id)::int AS design_count,
      COUNT(DISTINCT s.id)::int AS scene_count
    FROM workspace_projects wp
    LEFT JOIN projects d ON d.workspace_project_id=wp.id
    LEFT JOIN scenes s ON s.workspace_project_id=wp.id
    WHERE wp.user_id=${userId}
    GROUP BY wp.id
    ORDER BY wp.is_default DESC,updated_at DESC
  ` as {id:string;name:string;is_default:boolean;created_at:string;updated_at:string;design_count:number;scene_count:number}[];
  return rows.map(row=>({
    id:row.id,
    name:row.name,
    isDefault:row.is_default,
    designCount:Number(row.design_count??0),
    sceneCount:Number(row.scene_count??0),
    createdAt:row.created_at,
    updatedAt:row.updated_at,
  }));
}

export async function createWorkspaceProject(userId:string,name:string):Promise<WorkspaceProject>{
  await ensureV2Schema();
  const clean=name.trim().slice(0,120);
  if(!clean)throw new Error('Enter a project name.');
  const id=randomUUID();
  const rows=await getSql()`
    INSERT INTO workspace_projects(id,user_id,name,is_default)
    VALUES(${id},${userId},${clean},FALSE)
    RETURNING id,name,is_default,created_at,updated_at
  ` as {id:string;name:string;is_default:boolean;created_at:string;updated_at:string}[];
  const row=rows[0];
  return {id:row.id,name:row.name,isDefault:row.is_default,designCount:0,sceneCount:0,createdAt:row.created_at,updatedAt:row.updated_at};
}

export async function renameWorkspaceProject(userId:string,id:string,name:string){
  await ensureV2Schema();
  const clean=name.trim().slice(0,120);
  if(!clean)throw new Error('Enter a project name.');
  const rows=await getSql()`
    UPDATE workspace_projects SET name=${clean},updated_at=NOW()
    WHERE id=${id} AND user_id=${userId}
    RETURNING id,name,is_default
  ` as {id:string;name:string;is_default:boolean}[];
  return rows[0]??null;
}

export async function moveDesignToWorkspaceProject(userId:string,designId:string,projectId:string){
  const destination=await resolveWorkspaceProjectId(userId,projectId);
  const rows=await getSql()`
    UPDATE projects SET workspace_project_id=${destination},updated_at=NOW()
    WHERE id=${designId} AND user_id=${userId}
    RETURNING id
  ` as {id:string}[];
  return rows[0]?destination:null;
}

export async function deleteWorkspaceProject(userId:string,id:string,destinationId?:string|null){
  await ensureV2Schema();
  const sql=getSql();
  const rows=await sql`SELECT id,is_default FROM workspace_projects WHERE id=${id} AND user_id=${userId} LIMIT 1` as {id:string;is_default:boolean}[];
  const project=rows[0];
  if(!project)return null;
  if(project.is_default)throw new Error('My Project cannot be deleted.');
  const destination=await resolveWorkspaceProjectId(userId,destinationId);
  if(destination===id)throw new Error('Choose a different destination project.');
  await sql`UPDATE projects SET workspace_project_id=${destination},updated_at=NOW() WHERE user_id=${userId} AND workspace_project_id=${id}`;
  await sql`UPDATE scenes SET workspace_project_id=${destination},updated_at=NOW() WHERE user_id=${userId} AND workspace_project_id=${id}`;
  await sql`DELETE FROM workspace_projects WHERE id=${id} AND user_id=${userId} AND is_default=FALSE`;
  return destination;
}
