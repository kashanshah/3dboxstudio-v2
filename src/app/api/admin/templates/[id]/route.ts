import { NextResponse } from 'next/server';
import { requireAdminMutation } from '@/server/admin/auth';
import { deleteTemplate, setTemplateActive, TemplateAdminError, updateTemplateFields } from '@/server/admin/templates';
import { revalidateTemplatePages } from '@/server/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function failed(error: unknown) {
  if (error instanceof TemplateAdminError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('template change failed', error);
  return NextResponse.json({ error: 'The change could not be saved.' }, { status: 500 });
}

/** `{ active }` turns a template on or off; `{ fields }` saves its display fields. */
export async function PATCH(req: Request, { params }: Params) {
  const denied = await requireAdminMutation(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await req.json().catch(() => null) as { active?: unknown; fields?: unknown } | null;
  try {
    if (typeof body?.active === 'boolean') {
      await setTemplateActive(id, body.active);
    } else if (body?.fields && typeof body.fields === 'object' && !Array.isArray(body.fields)) {
      await updateTemplateFields(id, body.fields as Record<string, unknown>);
    } else {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
    }
    await revalidateTemplatePages();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failed(error);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const denied = await requireAdminMutation(req);
  if (denied) return denied;
  try {
    await deleteTemplate((await params).id);
    await revalidateTemplatePages();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failed(error);
  }
}
