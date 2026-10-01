import { NextResponse } from 'next/server';
import { ensureV2Schema,getSql } from '@/server/db';
import { getCurrentUser } from '@/server/auth/session';
import { toPublicUser,type UserRow } from '@/server/auth/users';
import { cleanName } from '@/server/auth/validation';
import { guardAuthAction } from '@/server/auth/action-request';
import { captureServerEvent } from '@/lib/posthog-server';
export async function PATCH(req:Request){
 const denied=guardAuthAction(req,'profile',20);if(denied)return denied;
 await ensureV2Schema();const user=await getCurrentUser();if(!user)return NextResponse.json({error:'Sign in to update your account.'},{status:401});
 const body=await req.json().catch(()=>null);if(typeof body?.name!=='string'||body.name.length>120)return NextResponse.json({error:'Use a name of up to 120 characters.'},{status:400});
 const rows=await getSql()`UPDATE users SET name=${cleanName(body.name)} WHERE id=${user.id} RETURNING *` as UserRow[];
 await captureServerEvent(user.id,'profile_updated',{field:'name'});
 return NextResponse.json({user:toPublicUser(rows[0]),message:'Profile updated.'});
}
