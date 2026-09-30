import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { guardAuthAction,validActionToken } from '@/server/auth/action-request';
import { verifyEmail } from '@/server/auth/email-actions';
export const runtime='nodejs';
export async function POST(req:Request){
 const denied=guardAuthAction(req,'verify-email',12);if(denied)return denied;
 const body=await req.json().catch(()=>null);if(!validActionToken(body?.token))return NextResponse.json({error:'This verification link is invalid.'},{status:400});
 await ensureV2Schema();if(!await verifyEmail(body.token))return NextResponse.json({error:'This link has expired or has already been used. Request a new verification email.'},{status:400});
 return NextResponse.json({message:'Your email is verified.'});
}
