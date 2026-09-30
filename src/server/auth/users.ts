import { randomBytes } from 'node:crypto';
import { getSql } from '@/server/db';
import { hashPassword } from './password';

export type UserRow={
  id:string;
  email:string;
  name:string|null;
  password_hash:string|null;
  email_verified_at:string|null;
  created_at:string;
  signup_method:string|null;
};

export type PublicUser={
  id:string;
  email:string;
  name:string|null;
  emailVerified:boolean;
  hasPassword:boolean;
  createdAt:string;
  signupMethod:string|null;
};

export function normalizeEmail(email:string){ return email.trim().toLowerCase(); }
export function toPublicUser(row:UserRow):PublicUser{
  return {
    id:row.id,email:row.email,name:row.name,
    emailVerified:Boolean(row.email_verified_at),
    hasPassword:Boolean(row.password_hash),
    createdAt:row.created_at,
    signupMethod:row.signup_method,
  };
}

function createUserId(){ return randomBytes(15).toString('hex').slice(0,20); }

export async function getUserByEmail(email:string):Promise<UserRow|null>{
  const sql=getSql();
  const rows=await sql`
    SELECT id,email,name,password_hash,email_verified_at,created_at,signup_method
    FROM users WHERE email=${normalizeEmail(email)} LIMIT 1
  ` as UserRow[];
  return rows[0]??null;
}

export async function getUserById(id:string):Promise<UserRow|null>{
  const sql=getSql();
  const rows=await sql`
    SELECT id,email,name,password_hash,email_verified_at,created_at,signup_method
    FROM users WHERE id=${id} LIMIT 1
  ` as UserRow[];
  return rows[0]??null;
}

export async function createEmailUser(input:{email:string;password:string;name:string|null}):Promise<UserRow>{
  const sql=getSql();
  const id=createUserId();
  const passwordHash=await hashPassword(input.password);
  const rows=await sql`
    INSERT INTO users(id,email,name,password_hash,signup_method)
    VALUES(${id},${normalizeEmail(input.email)},${input.name},${passwordHash},'email')
    RETURNING id,email,name,password_hash,email_verified_at,created_at,signup_method
  ` as UserRow[];
  return rows[0];
}

export async function findOrCreateGoogleUser(profile:{sub:string;email:string;name:string|null;emailVerified:boolean}){
  if(!profile.emailVerified) throw new Error('Google email must be verified before sign-in or account linking');
  const sql=getSql();
  const linked=await sql`
    SELECT u.id,u.email,u.name,u.password_hash,u.email_verified_at,u.created_at,u.signup_method
    FROM oauth_accounts o
    JOIN users u ON u.id=o.user_id
    WHERE o.provider='google' AND o.provider_account_id=${profile.sub}
    LIMIT 1
  ` as UserRow[];
  if(linked[0]) return {user:linked[0],isNew:false};

  const normalized=normalizeEmail(profile.email);
  let user=await getUserByEmail(normalized);
  let isNew=false;
  if(!user){
    isNew=true;
    const id=createUserId();
    const rows=await sql`
      INSERT INTO users(id,email,name,email_verified_at,signup_method)
      VALUES(${id},${normalized},${profile.name},${profile.emailVerified?new Date().toISOString():null},'google')
      RETURNING id,email,name,password_hash,email_verified_at,created_at,signup_method
    ` as UserRow[];
    user=rows[0];
  } else if(profile.emailVerified && !user.email_verified_at){
    const rows=await sql`
      UPDATE users SET email_verified_at=NOW()
      WHERE id=${user.id}
      RETURNING id,email,name,password_hash,email_verified_at,created_at,signup_method
    ` as UserRow[];
    user=rows[0];
  }

  await sql`
    INSERT INTO oauth_accounts(provider,provider_account_id,user_id)
    VALUES('google',${profile.sub},${user.id})
    ON CONFLICT(provider,provider_account_id)
    DO NOTHING
  `;
  const identity=await sql`SELECT user_id FROM oauth_accounts WHERE provider='google' AND provider_account_id=${profile.sub}` as {user_id:string}[];
  if(identity[0]?.user_id!==user.id) throw new Error('Google identity is already linked to another account');
  return {user,isNew};
}
