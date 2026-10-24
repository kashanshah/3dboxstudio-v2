import { NextResponse,after } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { guardAuthAction,validActionToken } from '@/server/auth/action-request';
import { verifyEmail } from '@/server/auth/email-actions';
import { sendWelcomeEmailSafely } from '@/server/onboarding-emails';
export const runtime='nodejs';
export async function POST(req:Request){
 const denied=guardAuthAction(req,'verify-email',12);if(denied)return denied;
 const body=await req.json().catch(()=>null);if(!validActionToken(body?.token))return NextResponse.json({error:'This verification link is invalid.'},{status:400});
 await ensureV2Schema();const userId=await verifyEmail(body.token);if(!userId)return NextResponse.json({error:'This link has expired or has already been used. Request a new verification email.'},{status:400});
 after(()=>sendWelcomeEmailSafely(userId));
 return NextResponse.json({message:'Your email is verified.'});
}
