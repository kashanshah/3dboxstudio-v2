import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const ADMIN_COOKIE = 'sb_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function adminPassword(): string {
  const value = process.env.ADMIN_PASSWORD?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('ADMIN_PASSWORD is not configured');
  return '3dboxstudio-admin';
}
function sign(payload: string) { return createHmac('sha256', `admin:${adminPassword()}`).update(payload).digest('base64url'); }
function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function verifyAdminPassword(password: string) { return Boolean(password) && safeEqual(password, adminPassword()); }
export function createAdminSessionToken() {
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${sign(exp)}`;
}
export function verifyAdminSessionToken(token?: string | null) {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const payload = token.slice(0,dot), sig = token.slice(dot+1);
  const exp = Number(payload);
  return Number.isFinite(exp) && exp >= Date.now() && safeEqual(sig, sign(payload));
}
export async function isAdminAuthenticated() {
  return verifyAdminSessionToken((await cookies()).get(ADMIN_COOKIE)?.value);
}
export async function setAdminCookie(token: string) {
  (await cookies()).set(ADMIN_COOKIE, token, { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', maxAge:Math.floor(SESSION_TTL_MS/1000) });
}
export async function clearAdminCookie() {
  (await cookies()).set(ADMIN_COOKIE, '', { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', maxAge:0 });
}
export async function requireAdminApi(): Promise<NextResponse | null> {
  return (await isAdminAuthenticated()) ? null : NextResponse.json({ error:'Admin authentication required.' }, { status:401 });
}
