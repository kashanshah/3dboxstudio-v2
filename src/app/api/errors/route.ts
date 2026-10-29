import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { recordError } from '@/server/error-log';
import { enforceRateLimit } from '@/server/rate-limit';
import { requestOrigin } from '@/server/request-origin';
import { CLIENT_ERROR_KINDS } from '@/lib/error-reporting';

// Errors in visitors' browsers, for Admin → Errors (src/lib/error-reporting.ts
// sends them). Only from this site's own pages, a few a minute per visitor;
// the signed-in account is read from the session, never from the report.

const MAX_BYTES = 16_000;

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin || origin !== requestOrigin(req)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  const limited = enforceRateLimit(req, 'client-errors', { windowMs: 10 * 60_000, max: 20 });
  if (limited) return limited;
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: 'Report too large.' }, { status: 413 });
  let body: { kind?: unknown; message?: unknown; path?: unknown; details?: unknown };
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: 'Invalid report.' }, { status: 400 }); }
  const kind = CLIENT_ERROR_KINDS.find(item => item === body.kind);
  if (!kind || typeof body.message !== 'string') return NextResponse.json({ error: 'Invalid report.' }, { status: 400 });
  const details = body.details && typeof body.details === 'object' && !Array.isArray(body.details) ? body.details as Record<string, unknown> : undefined;
  const user = await getCurrentUser();
  await recordError({ source: 'client', kind, message: body.message, path: typeof body.path === 'string' ? body.path : null, userId: user?.id ?? null, details: { ...details, user_agent: req.headers.get('user-agent') ?? undefined } });
  return new NextResponse(null, { status: 204 });
}
