import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { createSession,setSessionCookie } from '@/server/auth/session';
import { exchangeGoogleCode } from '@/server/auth/google';
import { findOrCreateGoogleUser } from '@/server/auth/users';
import { requestOrigin } from '@/server/request-origin';

export const runtime='nodejs';

export async function GET(req:Request){
  const url=new URL(req.url);
  const code=url.searchParams.get('code');
  const state=url.searchParams.get('state');
  const error=url.searchParams.get('error');
  const origin=requestOrigin(req);
  if(error) return NextResponse.redirect(new URL('/?auth_error=google_denied',origin));
  if(!code||!state) return NextResponse.redirect(new URL('/?auth_error=google_invalid',origin));
  try{
    await ensureV2Schema();
    const profile=await exchangeGoogleCode(req,code,state);
    const {user}=await findOrCreateGoogleUser(profile);
    const token=await createSession(user.id);
    await setSessionCookie(token);
    return NextResponse.redirect(new URL('/studio?auth=google',origin));
  }catch(error){
    console.error('Google OAuth callback failed',error);
    return NextResponse.redirect(new URL('/?auth_error=google_failed',origin));
  }
}
