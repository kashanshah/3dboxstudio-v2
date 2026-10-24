import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/server/admin/auth';
import { ensureV2Schema, getSql } from '@/server/db';
import { requestOrigin } from '@/server/request-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Gives an account Pro access (beta Pro features, src/lib/features.ts) or
 * takes it away. Posted by the form on the admin user profile; returns to the
 * page it was sent from.
 */
export async function POST(req: Request, { params }: Params) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const origin = requestOrigin(req);
  if (req.headers.get('origin') !== origin || req.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  const { id } = await params;
  const grant = (await req.formData().catch(() => null))?.get('pro') === 'on';
  await ensureV2Schema();
  await getSql()`UPDATE users SET pro_access_at=CASE WHEN ${grant} THEN COALESCE(pro_access_at,NOW()) ELSE NULL END WHERE id=${id}`;
  const referer = req.headers.get('referer');
  const back = referer && new URL(referer).origin === origin && new URL(referer).pathname.startsWith('/admin/') ? referer : `/admin/users/${encodeURIComponent(id)}`;
  return NextResponse.redirect(new URL(back, origin), 303);
}
