import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ensureV2Schema,getSql } from '@/server/db';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { validProjectState } from '@/lib/studio-project';
import { resolveWorkspaceProjectId } from '@/server/workspace-projects';
import { captureServerEvent } from '@/lib/posthog-server';
import { emitPostHogLog } from '@/lib/posthog-logs';
import { adoptLegacyDesign } from '@/server/legacy-designs';
export async function saveProject(req:Request,id?:string){
 const denied=guardAuthAction(req,'save-project',60);if(denied)return denied;
 await ensureV2Schema();const user=await getCurrentUser();if(!user)return NextResponse.json({error:'Sign in to save your design.'},{status:401});
 const raw=await req.text();if(Buffer.byteLength(raw)>3*1024*1024)return NextResponse.json({error:'This design exceeds the current 3 MB save limit. Use smaller artwork images and try again.'},{status:413});
 let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid design data.'},{status:400});}
 if(typeof body?.name!=='string'||!body.name.trim()||body.name.length>120||!validProjectState(body.state)||typeof body.preview!=='string'||body.preview.length>250000||!/^data:image\/png;base64,/.test(body.preview))return NextResponse.json({error:'Invalid design data.'},{status:400});
 const sql=getSql();let rows;
 const workspaceProjectId=await resolveWorkspaceProjectId(user.id,typeof body.workspaceProjectId==='string'?body.workspaceProjectId:null);
 if(id){
  const force=body.force===true;
  if(!force&&(!Number.isInteger(body.revision)||body.revision<1))return NextResponse.json({error:'Reload the design before saving.'},{status:409});
  rows=force
   ? await sql`UPDATE projects SET name=${body.name.trim()},studio_state=${JSON.stringify(body.state)}::jsonb,preview_image_key=${body.preview},workspace_project_id=${workspaceProjectId},updated_at=NOW(),revision=revision+1 WHERE id=${id} AND user_id=${user.id} RETURNING id,updated_at,revision,workspace_project_id`
   : await sql`UPDATE projects SET name=${body.name.trim()},studio_state=${JSON.stringify(body.state)}::jsonb,preview_image_key=${body.preview},workspace_project_id=${workspaceProjectId},updated_at=NOW(),revision=revision+1 WHERE id=${id} AND user_id=${user.id} AND revision=${body.revision} RETURNING id,updated_at,revision,workspace_project_id`;
 }
 else {id=randomUUID();rows=await sql`INSERT INTO projects(id,user_id,name,studio_state,preview_image_key,workspace_project_id) VALUES(${id},${user.id},${body.name.trim()},${JSON.stringify(body.state)}::jsonb,${body.preview},${workspaceProjectId}) RETURNING id,updated_at,revision,workspace_project_id`;}
 if(!(rows as unknown[]).length)return NextResponse.json({error:'The design was changed elsewhere or is no longer available. Reload before saving.'},{status:409});
 const project=(rows as {id:string;updated_at:string;revision:number;workspace_project_id:string}[])[0];
 const saveType=project.revision===1?'created':'updated';
 // Saving a legacy design (opened from the library) makes it a normal V2
 // project: retire the legacy library entry and move its V1 share link onto
 // this project. No-op unless the user owns a still-active legacy record.
 if(typeof body.state.legacySourceId==='string'&&body.state.legacySourceId){
  try{await adoptLegacyDesign(user.id,body.state.legacySourceId,{id:project.id,name:body.name.trim(),state:body.state});}
  catch(error){console.error('legacy design adoption failed',{designId:project.id,error:error instanceof Error?error.message:String(error)});}
 }
 await captureServerEvent(user.id,'design_saved',{design_id:project.id,save_type:saveType,revision:project.revision,template_id:body.state.templateId});
 emitPostHogLog('Design persistence completed',{event:'design.persistence',posthogDistinctId:user.id,design_id:project.id,save_type:saveType,revision:project.revision,template_id:body.state.templateId,status:'success'});
 return NextResponse.json({project});
}
