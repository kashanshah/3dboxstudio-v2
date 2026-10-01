import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { deleteWorkspaceProject,renameWorkspaceProject } from '@/server/workspace-projects';

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const denied=guardAuthAction(req,'workspace-project-action',60);if(denied)return denied;
  const user=await getCurrentUser();if(!user)return NextResponse.json({error:'Sign in to update a project.'},{status:401});
  const {id}=await params;
  const body=await req.json().catch(()=>null) as {name?:unknown}|null;
  if(typeof body?.name!=='string')return NextResponse.json({error:'Enter a project name.'},{status:400});
  try{
    const project=await renameWorkspaceProject(user.id,id,body.name);
    return project?NextResponse.json({project}):NextResponse.json({error:'Project not found.'},{status:404});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not rename project.'},{status:400});}
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
  const denied=guardAuthAction(req,'workspace-project-action',30);if(denied)return denied;
  const user=await getCurrentUser();if(!user)return NextResponse.json({error:'Sign in to delete a project.'},{status:401});
  const {id}=await params;
  try{
    const deleted=await deleteWorkspaceProject(user.id,id);
    return deleted?NextResponse.json({deleted:true}):NextResponse.json({error:'Project not found.'},{status:404});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not delete project.'},{status:400});}
}
