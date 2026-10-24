import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { revokeDesignShare } from '@/server/design-shares';
import { getShareSettings, parseShareSettings, ShareSettingsError, updateShareSettings } from '@/server/client-shares';
import { isFeatureOn } from '@/lib/features';

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
  const denied=guardAuthAction(req,'design-share-revoke',30,5*60_000);if(denied)return denied;
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in to manage share links.'},{status:401});
  const ok=await revokeDesignShare(user.id,(await params).id);
  return ok?NextResponse.json({revoked:true}):NextResponse.json({error:'Share link not found.'},{status:404});
}

/** The owner's client share settings (brand and password). */
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in to manage share links.'},{status:401});
  const settings=await getShareSettings(user.id,(await params).id);
  return settings?NextResponse.json({settings}):NextResponse.json({error:'Share link not found.'},{status:404});
}

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const denied=guardAuthAction(req,'design-share-settings',30,5*60_000);if(denied)return denied;
  if(!isFeatureOn('clientShares'))return NextResponse.json({error:'Not found.'},{status:404});
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in to manage share links.'},{status:401});
  const parsed=parseShareSettings(await req.json().catch(()=>({})));
  if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:400});
  try{
    const settings=await updateShareSettings(user.id,(await params).id,parsed.value);
    return settings?NextResponse.json({settings}):NextResponse.json({error:'Share link not found.'},{status:404});
  }catch(error){
    if(error instanceof ShareSettingsError)return NextResponse.json({error:error.message},{status:400});
    throw error;
  }
}
