import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { upsertDesignShare } from '@/server/design-shares';
import { site } from '@/lib/site';

export async function POST(req:Request){
  const denied=guardAuthAction(req,'design-share',30,5*60_000);if(denied)return denied;
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in to share designs.'},{status:401});
  const body=await req.json().catch(()=>null) as {projectId?:unknown;name?:unknown;state?:unknown}|null;
  if(typeof body?.name!=='string'||!body.state)return NextResponse.json({error:'Invalid share data.'},{status:400});
  try{
    const share=await upsertDesignShare(user.id,{projectId:typeof body.projectId==='string'?body.projectId:null,name:body.name,state:body.state});
    const path=`/studio/${encodeURIComponent(share.id)}`;
    return NextResponse.json({share:{id:share.id,path,url:new URL(path,site.url).toString(),updatedAt:share.updated_at}});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Could not create share link.'},{status:400});
  }
}
