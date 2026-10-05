import { emailUserHrefs } from '@/server/admin/email-users';
import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/server/admin/auth';
import { getSentEmail, sentEmailCursor } from '@/server/email/resend-log';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await params;
  if (!sentEmailCursor(id)) return NextResponse.json({ error: 'That email id is not valid.' }, { status: 400 });
  try {
    const result = await getSentEmail(id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    const email = result.data;
    const userHrefs = await emailUserHrefs([email.from, ...email.to, ...email.cc, ...email.bcc, ...email.replyTo]);
    return NextResponse.json({ email, userHrefs });
  } catch (error) {
    console.error('GET /api/admin/emails/[id] failed:', error);
    return NextResponse.json({ error: 'Could not load that email.' }, { status: 500 });
  }
}
