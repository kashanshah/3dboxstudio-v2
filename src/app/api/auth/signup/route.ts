import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { guardAuthAction } from '@/server/auth/action-request';
import { cleanName,isValidEmail,passwordError } from '@/server/auth/validation';
import { createEmailUser,getUserByEmail,toPublicUser } from '@/server/auth/users';
import { issueEmailAction } from '@/server/auth/email-actions';
import { createSession,setSessionCookie } from '@/server/auth/session';
import { captureServerUserEvent } from '@/lib/posthog-server';

export const runtime='nodejs';

export async function POST(req:Request){
  const limited=guardAuthAction(req,'signup',6,60*60*1000);
  if(limited) return limited;
  await ensureV2Schema();
  const body=await req.json().catch(()=>null) as {email?:unknown;password?:unknown;name?:unknown}|null;
  if(!isValidEmail(body?.email)) return NextResponse.json({error:'Enter a valid email address.'},{status:400});
  const error=passwordError(body?.password);
  if(error) return NextResponse.json({error},{status:400});
  const existing=await getUserByEmail(body.email);
  if(existing) return NextResponse.json({error:'An account with this email already exists. Try signing in instead.'},{status:409});
  const user=await createEmailUser({email:body.email,password:body!.password as string,name:cleanName(body?.name)});
  const token=await createSession(user.id);
  await setSessionCookie(token);
  const verificationSent=await issueEmailAction(user,'verify').catch(()=>false);
  await captureServerUserEvent(user.id,'user_signed_up',{method:'password',verification_sent:verificationSent},{email:user.email,name:user.name,signup_method:user.signup_method});
  return NextResponse.json({user:toPublicUser(user),verificationSent},{status:201});
}
