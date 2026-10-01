import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { createWorkspaceProject,listWorkspaceProjects } from '@/server/workspace-projects';
import { captureServerEvent,captureServerException } from '@/lib/posthog-server';

export async function GET(){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in to view your projects.'},{status:401});
  return NextResponse.json({projects:await listWorkspaceProjects(user.id)});
}

export async function POST(req:Request){
  const denied=guardAuthAction(req,'create-workspace-project',30);if(denied)return denied;
  const user=await getCurrentUser();if(!user)return NextResponse.json({error:'Sign in to create a project.'},{status:401});
  const body=await req.json().catch(()=>null) as {name?:unknown}|null;
  if(typeof body?.name!=='string'||!body.name.trim())return NextResponse.json({error:'Enter a project name.'},{status:400});
  try{
    const project=await createWorkspaceProject(user.id,body.name);
    await captureServerEvent(user.id,'workspace_project_created',{workspace_project_id:project.id});
    return NextResponse.json({project},{status:201});
  }
  catch(error){await captureServerException(error,user.id);return NextResponse.json({error:error instanceof Error?error.message:'Could not create project.'},{status:400});}
}
