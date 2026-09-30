import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { getSql } from '@/server/db';
import { toPublicUser,type PublicUser,type UserRow } from './users';

export const SESSION_COOKIE='sb_session';
const SESSION_TTL_DAYS=30;

function token(){ return randomBytes(30).toString('base64url'); }

export async function createSession(userId:string){
  const sql=getSql();
  const value=token();
  await sql`
    INSERT INTO sessions(token,user_id,expires_at)
    VALUES(${value},${userId},NOW()+(${SESSION_TTL_DAYS}*INTERVAL '1 day'))
  `;
  return value;
}

export async function setSessionCookie(value:string){
  const store=await cookies();
  store.set(SESSION_COOKIE,value,{
    httpOnly:true,
    secure:process.env.NODE_ENV==='production',
    sameSite:'lax',
    path:'/',
    maxAge:SESSION_TTL_DAYS*24*60*60,
  });
}

export async function clearSessionCookie(){
  const store=await cookies();
  store.set(SESSION_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
}

export async function deleteCurrentSession(){
  const store=await cookies();
  const value=store.get(SESSION_COOKIE)?.value;
  if(value){
    const sql=getSql();
    await sql`DELETE FROM sessions WHERE token=${value}`;
  }
  await clearSessionCookie();
}

async function rowForSession(value:string):Promise<UserRow|null>{
  const sql=getSql();
  const rows=await sql`
    SELECT u.id,u.email,u.name,u.password_hash,u.email_verified_at,u.created_at,u.signup_method
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token=${value} AND s.expires_at>NOW()
    LIMIT 1
  ` as UserRow[];
  return rows[0]??null;
}

export async function getCurrentUser():Promise<PublicUser|null>{
  const store=await cookies();
  const value=store.get(SESSION_COOKIE)?.value;
  if(!value) return null;
  try{
    const row=await rowForSession(value);
    return row?toPublicUser(row):null;
  }catch{return null;}
}
