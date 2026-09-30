import { NextResponse } from 'next/server';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function enforceRateLimit(req: Request, scope: string, config: { windowMs: number; max: number }): NextResponse | null {
  const key = `${scope}:${getClientIp(req)}`;
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }
  if (current.count >= config.max) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((current.resetAt-now)/1000)) } });
  }
  current.count += 1;
  return null;
}
