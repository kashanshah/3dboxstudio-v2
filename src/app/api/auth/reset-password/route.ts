import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { guardAuthAction,validActionToken } from '@/server/auth/action-request';
import { passwordError } from '@/server/auth/validation';
import { resetPassword } from '@/server/auth/email-actions';
export const runtime='nodejs';
export async function POST(req:Request){
 const denied=guardAuthAction(req,'reset-password');if(denied)return denied;
 const body=await req.json().catch(()=>null);const error=passwordError(body?.password);
 if(error||!validActionToken(body?.token))return NextResponse.json({error:error||'This reset link is invalid.'},{status:400});
 await ensureV2Schema();if(!await resetPassword(body.token,body.password))return NextResponse.json({error:'This reset link has expired or has already been used. Request a new link.'},{status:400});
 return NextResponse.json({message:'Password updated. Sign in with your new password.'});
}
