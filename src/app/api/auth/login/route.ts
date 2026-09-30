import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { enforceRateLimit } from '@/server/rate-limit';
import { getUserByEmail,toPublicUser } from '@/server/auth/users';
import { verifyPassword } from '@/server/auth/password';
import { createSession,setSessionCookie } from '@/server/auth/session';
import { isValidEmail } from '@/server/auth/validation';

export const runtime='nodejs';

export async function POST(req:Request){
  const limited=enforceRateLimit(req,'auth:login',{windowMs:15*60*1000,max:12});
  if(limited) return limited;
  await ensureV2Schema();
  const body=await req.json().catch(()=>null) as {email?:unknown;password?:unknown}|null;
  if(!isValidEmail(body?.email)||typeof body?.password!=='string'||!body.password){
    return NextResponse.json({error:'Enter your email and password.'},{status:400});
  }
  const user=await getUserByEmail(body.email);
  if(!user) return NextResponse.json({error:'Incorrect email or password.'},{status:401});
  if(!user.password_hash){
    return NextResponse.json({error:'This account uses Google sign-in. Continue with Google instead.'},{status:401});
  }
  if(!(await verifyPassword(body.password,user.password_hash))){
    return NextResponse.json({error:'Incorrect email or password.'},{status:401});
  }
  const token=await createSession(user.id);
  await setSessionCookie(token);
  return NextResponse.json({user:toPublicUser(user)});
}
