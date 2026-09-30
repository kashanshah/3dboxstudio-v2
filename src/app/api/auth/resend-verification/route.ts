import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { getCurrentUser } from '@/server/auth/session';
import { getUserById } from '@/server/auth/users';
import { guardAuthAction } from '@/server/auth/action-request';
import { issueEmailAction } from '@/server/auth/email-actions';
export async function POST(req:Request){
 const denied=guardAuthAction(req,'resend-verification');if(denied)return denied;
 await ensureV2Schema();const current=await getCurrentUser();if(!current)return NextResponse.json({error:'Sign in to request a verification email.'},{status:401});
 const user=await getUserById(current.id);if(!user)return NextResponse.json({error:'Account not found.'},{status:404});
 if(user.email_verified_at)return NextResponse.json({message:'Your email is already verified.'});
 try{const sent=await issueEmailAction(user,'verify');return NextResponse.json({message:sent?'Verification email sent. Check your inbox.':'Please wait a minute before requesting another email.'});}
 catch{return NextResponse.json({error:'We could not send the verification email. Please try again shortly.'},{status:503});}
}
