import { createHash, randomBytes } from 'node:crypto';
import { getSql } from '@/server/db';
import { sendEmail } from '@/server/email/mailer';
import { hashPassword } from './password';
import type { UserRow } from './users';
export function tokenDigest(token:string){return createHash('sha256').update(token).digest('hex');}
export const RESET_PASSWORD_SQL=`WITH locked AS (
 SELECT u.id FROM users u JOIN password_reset_tokens t ON t.user_id=u.id
 WHERE t.token=$1 AND t.consumed_at IS NULL AND t.expires_at>NOW() FOR UPDATE OF u
), consumed AS (
 UPDATE password_reset_tokens SET consumed_at=NOW() WHERE token=$1 AND consumed_at IS NULL AND expires_at>NOW() AND user_id IN(SELECT id FROM locked) RETURNING user_id
), changed AS (
 UPDATE users SET password_hash=$2 WHERE id IN(SELECT user_id FROM consumed) RETURNING id
), revoked AS (
 DELETE FROM sessions WHERE user_id IN(SELECT id FROM changed)
), expired AS (
 UPDATE password_reset_tokens SET consumed_at=NOW() WHERE user_id IN(SELECT id FROM changed) AND token<>$1 AND consumed_at IS NULL
) SELECT id FROM changed`;
export const VERIFY_EMAIL_SQL=`WITH consumed AS (
 UPDATE email_verification_tokens t SET consumed_at=NOW() FROM users u
 WHERE t.token=$1 AND t.user_id=u.id AND t.email=u.email AND t.consumed_at IS NULL AND t.expires_at>NOW() RETURNING t.user_id
) UPDATE users SET email_verified_at=COALESCE(email_verified_at,NOW()) WHERE id IN(SELECT user_id FROM consumed) RETURNING id`;
export async function issueEmailAction(user:UserRow,kind:'verify'|'reset'){
 const sql=getSql(),table=kind==='verify'?'email_verification_tokens':'password_reset_tokens';
 const recent=await sql.query(`SELECT 1 FROM ${table} WHERE user_id=$1 AND created_at>NOW()-INTERVAL '60 seconds' LIMIT 1`,[user.id]);
 if((recent as unknown[]).length)return false;
 const token=randomBytes(32).toString('base64url'),digest=tokenDigest(token);
 if(kind==='verify')await sql`INSERT INTO email_verification_tokens(token,user_id,email,expires_at) VALUES(${digest},${user.id},${user.email},NOW()+INTERVAL '24 hours')`;
 else await sql`INSERT INTO password_reset_tokens(token,user_id,expires_at) VALUES(${digest},${user.id},NOW()+INTERVAL '1 hour')`;
 const origin=process.env.AUTH_APP_URL?.trim()||process.env.NEXT_PUBLIC_SITE_URL?.trim();
 if(!origin) {await sql.query(`DELETE FROM ${table} WHERE token=$1`,[digest]);throw new Error('AUTH_APP_URL must be configured for account emails');}
 const url=new URL(kind==='verify'?'/verify-email':'/reset-password',origin);url.searchParams.set('token',token);
 const action=kind==='verify'?'Verify your email':'Reset your password';
 try{await sendEmail({to:user.email,subject:`${action} — 3D Box Studio`,text:`${action}: ${url.toString()}\nThis link expires in ${kind==='verify'?'24 hours':'1 hour'}. If you did not request this, ignore this email.`,html:`<h1>${action}</h1><p><a href="${url.toString()}">${action}</a></p><p>This link expires in ${kind==='verify'?'24 hours':'1 hour'}. If you did not request this, ignore this email.</p>`});return true;}
 catch(error){await sql.query(`DELETE FROM ${table} WHERE token=$1`,[digest]);throw error;}
}
export async function resetPassword(token:string,password:string){const rows=await getSql().query(RESET_PASSWORD_SQL,[tokenDigest(token),await hashPassword(password)]);return (rows as unknown[]).length>0;}
export async function verifyEmail(token:string){const rows=await getSql().query(VERIFY_EMAIL_SQL,[tokenDigest(token)]);return (rows as unknown[]).length>0;}
