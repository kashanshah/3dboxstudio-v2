import { NextResponse } from 'next/server';
import { guardAuthAction } from '@/server/auth/action-request';
import { unlockCookieMaxAge, unlockCookieName, unlockShare } from '@/server/client-shares';
import { requestOrigin } from '@/server/request-origin';

export const runtime='nodejs';

// The password form on a protected share. A right password sets a cookie that
// opens the share (and its images) for 30 days on this browser.
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const denied=guardAuthAction(req,'share-unlock',10,15*60_000);if(denied)return denied;
  const {id}=await params;
  const body=await req.json().catch(()=>null) as {password?:unknown}|null;
  const password=typeof body?.password==='string'?body.password:'';
  const value=password?await unlockShare(id,password):null;
  if(!value)return NextResponse.json({error:'That password is not right.'},{status:403});
  const response=NextResponse.json({ok:true});
  response.cookies.set(unlockCookieName(id),value,{path:'/',httpOnly:true,sameSite:'lax',secure:requestOrigin(req).startsWith('https:'),maxAge:unlockCookieMaxAge});
  return response;
}
