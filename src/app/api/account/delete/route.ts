import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { getCurrentUser,clearSessionCookie } from '@/server/auth/session';
import { getUserById,normalizeEmail } from '@/server/auth/users';
import { verifyPassword } from '@/server/auth/password';
import { guardAuthAction } from '@/server/auth/action-request';
import { deleteAccount } from '@/server/account-deletion';
import { DeletionError } from '@/server/admin/deletions';
import { captureServerEvent } from '@/lib/posthog-server';
export async function POST(req:Request){
 const denied=guardAuthAction(req,'delete-account');if(denied)return denied;
 await ensureV2Schema();const current=await getCurrentUser();if(!current)return NextResponse.json({error:'Sign in to delete your account.'},{status:401});
 const body=await req.json().catch(()=>null);
 if(body?.confirm!=='DELETE')return NextResponse.json({error:'Type DELETE to confirm.'},{status:400});
 const user=await getUserById(current.id);if(!user)return NextResponse.json({error:'Sign in to delete your account.'},{status:401});
 // Re-check who is asking: the password when the account has one, else the account email (Google sign-in).
 if(user.password_hash){if(typeof body?.password!=='string'||!await verifyPassword(body.password,user.password_hash))return NextResponse.json({error:'Your password is incorrect.'},{status:400});}
 else if(typeof body?.email!=='string'||normalizeEmail(body.email)!==user.email)return NextResponse.json({error:'Enter the email address of this account.'},{status:400});
 try{await deleteAccount(user.id,user.email);}catch(error){
  if(error instanceof DeletionError)return NextResponse.json({error:'Your account is changing. Wait a moment and try again.'},{status:409});
  console.error('account deletion failed',{error});return NextResponse.json({error:'Your account could not be deleted. Try again or contact us.'},{status:500});
 }
 await captureServerEvent(user.id,'account_deleted',{signup_method:user.signup_method??'unknown'});
 await clearSessionCookie();return NextResponse.json({message:'Your account and designs have been deleted.'});
}
