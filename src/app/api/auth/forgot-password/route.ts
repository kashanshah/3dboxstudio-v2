import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { guardAuthAction } from '@/server/auth/action-request';
import { isValidEmail } from '@/server/auth/validation';
import { getUserByEmail } from '@/server/auth/users';
import { issueEmailAction } from '@/server/auth/email-actions';
import { alertAdmin } from '@/server/ops-alerts';
export const runtime='nodejs';
export async function POST(req:Request){
 const denied=guardAuthAction(req,'forgot-password');if(denied)return denied;
 const body=await req.json().catch(()=>null);if(!isValidEmail(body?.email))return NextResponse.json({error:'Enter a valid email address.'},{status:400});
 await ensureV2Schema();const user=await getUserByEmail(body.email);
 if(user?.password_hash)await issueEmailAction(user,'reset').catch(error=>alertAdmin('email_delivery','Password reset email could not be delivered',{user_id:user.id,recipient:user.email},error));
 return NextResponse.json({message:'If this email has a password account, a reset link will arrive shortly. Google accounts should continue with Google.'});
}
