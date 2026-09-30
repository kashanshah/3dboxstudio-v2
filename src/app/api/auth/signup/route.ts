import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { enforceRateLimit } from '@/server/rate-limit';
import { cleanName,isValidEmail,passwordError } from '@/server/auth/validation';
import { createEmailUser,getUserByEmail,toPublicUser } from '@/server/auth/users';
import { createSession,setSessionCookie } from '@/server/auth/session';

export const runtime='nodejs';

export async function POST(req:Request){
  const limited=enforceRateLimit(req,'auth:signup',{windowMs:60*60*1000,max:6});
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
  return NextResponse.json({user:toPublicUser(user)},{status:201});
}
