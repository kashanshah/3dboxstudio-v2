import { cookies } from 'next/headers';
import { safeReturnTo } from '@/lib/auth-navigation';
import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { createSession,setSessionCookie } from '@/server/auth/session';
import { exchangeGoogleCode,GoogleAuthError,OAUTH_RETURN_COOKIE } from '@/server/auth/google';
import { alertAdmin } from '@/server/ops-alerts';
import { findOrCreateGoogleUser } from '@/server/auth/users';
import { requestOrigin } from '@/server/request-origin';
import { captureServerUserEvent } from '@/lib/posthog-server';
import { SIGNUP_COOKIE,SIGNUP_COOKIE_MAX_AGE } from '@/lib/analytics/signup';

export const runtime='nodejs';

export async function GET(req:Request){
  const url=new URL(req.url);
  const code=url.searchParams.get('code');
  const state=url.searchParams.get('state');
  const error=url.searchParams.get('error');
  const origin=requestOrigin(req);
  if(error) return NextResponse.redirect(new URL('/login?auth_error=google_denied',origin));
  if(!code||!state) return NextResponse.redirect(new URL('/login?auth_error=google_invalid',origin));
  try{
    await ensureV2Schema();
    const profile=await exchangeGoogleCode(req,code,state);
    const {user,isNew}=await findOrCreateGoogleUser(profile);
    const token=await createSession(user.id);
    await setSessionCookie(token);
    const store=await cookies(),next=safeReturnTo(store.get(OAUTH_RETURN_COOKIE)?.value);
    store.delete(OAUTH_RETURN_COOKIE);
    const response=NextResponse.redirect(new URL(next,origin));
    if(isNew){
      // Analytics must never turn a successful sign-in into an error page.
      await captureServerUserEvent(user.id,'user_signed_up',{method:'google'},{email:user.email,name:user.name,signup_method:user.signup_method}).catch(()=>{});
      response.cookies.set(SIGNUP_COOKIE,'google',{path:'/',maxAge:SIGNUP_COOKIE_MAX_AGE,sameSite:'lax',secure:origin.startsWith('https:')});
    }
    return response;
  }catch(failure){
    const reason=failure instanceof GoogleAuthError?failure.reason:'unexpected';
    const detail=failure instanceof GoogleAuthError?failure.detail:undefined;
    if(failure instanceof GoogleAuthError&&failure.expected){
      console.warn('Google OAuth callback failed',{reason,detail});
    }else{
      await alertAdmin('google_oauth','Google sign-in failed',{reason,detail,host:new URL(origin).host},failure);
    }
    const authError=reason==='invalid_state'||reason==='invalid_grant'?'google_invalid':'google_failed';
    return NextResponse.redirect(new URL(`/login?auth_error=${authError}`,origin));
  }
}
