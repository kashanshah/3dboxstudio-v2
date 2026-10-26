import { NextResponse } from 'next/server';
import { requireAdminMutation } from '@/server/admin/auth';
import { resetTemplateFields, TemplateAdminError } from '@/server/admin/templates';
import { revalidateTemplatePages } from '@/server/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Reset to original: clears a built-in or JSON template's overrides. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminMutation(req);
  if (denied) return denied;
  try {
    await resetTemplateFields((await params).id);
    await revalidateTemplatePages();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TemplateAdminError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('template reset failed', error);
    return NextResponse.json({ error: 'The template could not be reset.' }, { status: 500 });
  }
}
