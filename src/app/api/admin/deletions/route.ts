import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/server/admin/auth';
import { requestOrigin } from '@/server/request-origin';
import { isDeletionKind } from '@/lib/admin-deletion';
import { DeletionError, executeDeletion, previewDeletion, retryDeletionFiles, pendingDeletionJobs } from '@/server/admin/deletions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function target(kind: unknown, id: unknown) {
  return isDeletionKind(kind) && typeof id === 'string' && id.length > 0 && id.length <= 1500;
}
function failure(error: unknown) {
  if (error instanceof DeletionError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('admin deletion failed', error);
  return NextResponse.json({ error: 'Could not complete deletion. Please try again.' }, { status: 500 });
}
export async function GET(req: Request) {
  const denied = await requireAdminApi(); if (denied) return denied;
  const params = new URL(req.url).searchParams;
  if (params.get('jobs') === '1') {
    try { return NextResponse.json({ jobs: await pendingDeletionJobs() }, { headers: { 'Cache-Control': 'no-store' } }); } catch (error) { return failure(error); }
  }
  const kind = params.get('kind'), id = params.get('id');
  if (!target(kind, id) || !isDeletionKind(kind) || !id) return NextResponse.json({ error: 'Invalid deletion target.' }, { status: 400 });
  try { return NextResponse.json(await previewDeletion(kind, id), { headers: { 'Cache-Control': 'no-store' } }); } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  const denied = await requireAdminApi(); if (denied) return denied;
  if (req.headers.get('origin') !== requestOrigin(req) || req.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  try {
    if (typeof body.jobId === 'string' && /^[0-9a-f-]{36}$/.test(body.jobId)) return NextResponse.json(await retryDeletionFiles(body.jobId));
    if (!target(body.kind, body.id) || !isDeletionKind(body.kind) || typeof body.token !== 'string' || body.token.length > 4000) return NextResponse.json({ error: 'Review and confirm deletion first.' }, { status: 400 });
    return NextResponse.json(await executeDeletion(body.kind, body.id, body.token));
  } catch (error) { return failure(error); }
}
