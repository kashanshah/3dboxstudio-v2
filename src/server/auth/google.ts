import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { optionalEnv } from '@/server/env';
import { requestOrigin } from '@/server/request-origin';

export const OAUTH_STATE_COOKIE='sb_oauth_state';

export function googleConfig(req:Request){
  const clientId=optionalEnv('GOOGLE_CLIENT_ID');
  const clientSecret=optionalEnv('GOOGLE_CLIENT_SECRET');
  if(!clientId||!clientSecret) return null;
  const redirectUri=optionalEnv('GOOGLE_REDIRECT_URI')||`${requestOrigin(req)}/api/auth/google/callback`;
  return {clientId,clientSecret,redirectUri};
}

export async function beginGoogleOAuth(req:Request){
  const config=googleConfig(req);
  if(!config) return null;
  const state=randomBytes(24).toString('base64url');
  const store=await cookies();
  store.set(OAUTH_STATE_COOKIE,state,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:600});
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id',config.clientId);
  url.searchParams.set('redirect_uri',config.redirectUri);
  url.searchParams.set('response_type','code');
  url.searchParams.set('scope','openid email profile');
  url.searchParams.set('state',state);
  url.searchParams.set('prompt','select_account');
  return url.toString();
}

export async function exchangeGoogleCode(req:Request,code:string,state:string){
  const config=googleConfig(req);
  if(!config) throw new Error('Google sign-in is not configured');
  const store=await cookies();
  const expected=store.get(OAUTH_STATE_COOKIE)?.value;
  store.set(OAUTH_STATE_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
  if(!expected||expected!==state) throw new Error('Invalid OAuth state');

  const body=new URLSearchParams({
    code,
    client_id:config.clientId,
    client_secret:config.clientSecret,
    redirect_uri:config.redirectUri,
    grant_type:'authorization_code',
  });
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,
  });
  if(!tokenResponse.ok) throw new Error('Google token exchange failed');
  const tokens=await tokenResponse.json() as {access_token?:string};
  if(!tokens.access_token) throw new Error('Google access token missing');

  const profileResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{
    headers:{Authorization:`Bearer ${tokens.access_token}`},
  });
  if(!profileResponse.ok) throw new Error('Google profile request failed');
  const profile=await profileResponse.json() as {sub?:string;email?:string;email_verified?:boolean;name?:string};
  if(!profile.sub||!profile.email) throw new Error('Google profile is incomplete');
  return {sub:profile.sub,email:profile.email,emailVerified:profile.email_verified===true,name:profile.name||null};
}
