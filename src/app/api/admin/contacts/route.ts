import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/server/admin/auth';
import { listContactSubmissions } from '@/server/contact-submissions';
import { CONTACT_STATUSES, setContactStatus, type ContactStatus } from '@/server/admin/contacts';

export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  return NextResponse.json({ items: await listContactSubmissions(100) });
}

/** Marks a message new or handled. */
export async function PATCH(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id.slice(0, 120) : '';
  const status = body?.status;
  if (!id || !(CONTACT_STATUSES as readonly unknown[]).includes(status)) return NextResponse.json({ error: 'Choose a message and a status.' }, { status: 400 });
  return await setContactStatus(id, status as ContactStatus)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Message not found.' }, { status: 404 });
}
