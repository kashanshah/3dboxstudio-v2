import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { createWorkspaceProject,listWorkspaceProjects } from '@/server/workspace-projects';

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
  try{return NextResponse.json({project:await createWorkspaceProject(user.id,body.name)},{status:201});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not create project.'},{status:400});}
}
