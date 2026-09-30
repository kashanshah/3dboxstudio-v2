import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { revokeDesignShare } from '@/server/design-shares';

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
  const denied=guardAuthAction(req,'design-share-revoke',30,5*60_000);if(denied)return denied;
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in to manage share links.'},{status:401});
  const ok=await revokeDesignShare(user.id,(await params).id);
  return ok?NextResponse.json({revoked:true}):NextResponse.json({error:'Share link not found.'},{status:404});
}
