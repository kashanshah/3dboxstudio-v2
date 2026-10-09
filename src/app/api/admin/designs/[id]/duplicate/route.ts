import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/server/admin/auth';
import { duplicateDesignForUser } from '@/server/admin/duplicate-design';
import { getCurrentUser } from '@/server/auth/session';
import { requestOrigin } from '@/server/request-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Copies a design into the Studio account signed in on this browser and opens
 * the copy in the editor. Posted by the form on the admin design page.
 */
export async function POST(req: Request, { params }: Params) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  if (req.headers.get('origin') !== requestOrigin(req) || req.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  const { id } = await params;
  const back = `/admin/designs/${encodeURIComponent(id)}`;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(back)}`, requestOrigin(req)), 303);
  try {
    const copy = await duplicateDesignForUser(id, user.id);
    if (!copy) return NextResponse.redirect(new URL(`${back}?copy=missing`, requestOrigin(req)), 303);
    return NextResponse.redirect(new URL(`/studio/editor?project=${encodeURIComponent(copy.id)}`, requestOrigin(req)), 303);
  } catch (error) {
    console.error('POST /api/admin/designs/[id]/duplicate failed:', error);
    return NextResponse.redirect(new URL(`${back}?copy=failed`, requestOrigin(req)), 303);
  }
}
