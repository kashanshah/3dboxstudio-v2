import { NextResponse } from 'next/server';
import { saveProject } from '@/server/project-save';
import { ensureV2Schema,getSql } from '@/server/db';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { moveDesignToWorkspaceProject } from '@/server/workspace-projects';
import { captureServerEvent } from '@/lib/posthog-server';

export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){
  return saveProject(req,(await params).id);
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const denied=guardAuthAction(req,'project-file-action',120);if(denied)return denied;
  await ensureV2Schema();
  const user=await getCurrentUser();if(!user)return NextResponse.json({error:'Sign in to update this design.'},{status:401});
  const {id}=await params;
  let body:unknown;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid project update.'},{status:400});}
  const favorite=(body as {favorite?:unknown})?.favorite;
  const workspaceProjectId=(body as {workspaceProjectId?:unknown})?.workspaceProjectId;
  if(typeof favorite==='boolean'){
    const rows=await getSql()`UPDATE projects SET is_favorite=${favorite} WHERE id=${id} AND user_id=${user.id} RETURNING id,is_favorite` as {id:string;is_favorite:boolean}[];
    if(!rows.length)return NextResponse.json({error:'Design not found.'},{status:404});
    return NextResponse.json({project:{id:rows[0].id,favorite:rows[0].is_favorite}});
  }
  if(typeof workspaceProjectId==='string'){
    const moved=await moveDesignToWorkspaceProject(user.id,id,workspaceProjectId);
    if(!moved)return NextResponse.json({error:'Design not found.'},{status:404});
    return NextResponse.json({project:{id,workspaceProjectId:moved}});
  }
  return NextResponse.json({error:'Invalid design update.'},{status:400});
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
  const denied=guardAuthAction(req,'delete-project',30);if(denied)return denied;
  await ensureV2Schema();
  const user=await getCurrentUser();if(!user)return NextResponse.json({error:'Sign in to delete this design.'},{status:401});
  const {id}=await params;
  const rows=await getSql()`DELETE FROM projects WHERE id=${id} AND user_id=${user.id} RETURNING id` as {id:string}[];
  if(!rows.length)return NextResponse.json({error:'Design not found.'},{status:404});
  await captureServerEvent(user.id,'design_deleted',{design_id:id});
  return NextResponse.json({deleted:true});
}
