import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { upsertDesignShare } from '@/server/design-shares';

export async function POST(req:Request){
  const denied=guardAuthAction(req,'design-share',30,5*60_000);if(denied)return denied;
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in to share designs.'},{status:401});
  const body=await req.json().catch(()=>null) as {projectId?:unknown}|null;
  if(typeof body?.projectId!=='string'||!body.projectId)return NextResponse.json({error:'Save this design before sharing it.'},{status:400});
  try{
    const rows=await (await import('@/server/db')).getSql()`
      SELECT id,name,studio_state FROM projects WHERE id=${body.projectId} AND user_id=${user.id} LIMIT 1
    ` as {id:string;name:string;studio_state:unknown}[];
    const project=rows[0];
    if(!project)return NextResponse.json({error:'Design not found.'},{status:404});
    const share=await upsertDesignShare(user.id,{projectId:project.id,name:project.name,state:project.studio_state});
    const path=`/studio/${encodeURIComponent(share.id)}`;
    return NextResponse.json({share:{id:share.id,path,updatedAt:share.updated_at}});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Could not create share link.'},{status:400});
  }
}
