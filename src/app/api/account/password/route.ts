import { NextResponse } from 'next/server';
import { ensureV2Schema,getSql } from '@/server/db';
import { getCurrentUser,clearSessionCookie } from '@/server/auth/session';
import { getUserById } from '@/server/auth/users';
import { verifyPassword,hashPassword } from '@/server/auth/password';
import { passwordError } from '@/server/auth/validation';
import { guardAuthAction } from '@/server/auth/action-request';
import { captureServerEvent } from '@/lib/posthog-server';
export async function POST(req:Request){
 const denied=guardAuthAction(req,'change-password');if(denied)return denied;
 await ensureV2Schema();const current=await getCurrentUser();if(!current)return NextResponse.json({error:'Sign in to change your password.'},{status:401});
 const body=await req.json().catch(()=>null),error=passwordError(body?.password);if(error)return NextResponse.json({error},{status:400});
 const user=await getUserById(current.id);
 if(!user?.password_hash||typeof body?.currentPassword!=='string'||!await verifyPassword(body.currentPassword,user.password_hash))return NextResponse.json({error:'Your current password is incorrect.'},{status:400});
 const next=await hashPassword(body.password),sql=getSql();
 const rows=await sql`WITH changed AS (UPDATE users SET password_hash=${next} WHERE id=${user.id} AND password_hash=${user.password_hash} RETURNING id),revoked AS (DELETE FROM sessions WHERE user_id IN(SELECT id FROM changed)),expired AS (UPDATE password_reset_tokens SET consumed_at=NOW() WHERE user_id IN(SELECT id FROM changed) AND consumed_at IS NULL) SELECT id FROM changed`;
 if(!(rows as unknown[]).length)return NextResponse.json({error:'Your account changed. Try again.'},{status:409});
 await captureServerEvent(user.id,'password_changed');
 await clearSessionCookie();return NextResponse.json({message:'Password updated. Sign in again.'});
}
