import { NextResponse } from 'next/server';
import { requireAdminMutation } from '@/server/admin/auth';
import { createJsonTemplate, createNamedTemplate, TemplateAdminError } from '@/server/admin/templates';
import { revalidateTemplatePages } from '@/server/templates';
import { JSON_TEMPLATE_LIMITS } from '@/lib/packaging/json-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Adds a template: `{ kind: 'named', baseTemplateId, slug, name, … }` (a
 * style with its own name and defaults, active at once) or `{ kind: 'json',
 * source }` (an uploaded definition, checked and saved as an inactive draft).
 */
export async function POST(req: Request) {
  const denied = await requireAdminMutation(req);
  if (denied) return denied;
  const text = await req.text();
  if (text.length > JSON_TEMPLATE_LIMITS.bytes * 2) return NextResponse.json({ error: 'The request is too large.' }, { status: 413 });
  let body: Record<string, unknown> | null = null;
  try { body = JSON.parse(text) as Record<string, unknown>; } catch { /* answered below */ }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Send the template as JSON.' }, { status: 400 });
  try {
    if (body.kind === 'named') {
      const id = await createNamedTemplate(body);
      await revalidateTemplatePages();
      return NextResponse.json({ id });
    }
    if (body.kind === 'json') {
      if (typeof body.source !== 'string' || !body.source.trim()) return NextResponse.json({ error: 'Paste or upload a definition.' }, { status: 400 });
      const created = await createJsonTemplate(body.source);
      // A draft is listed nowhere public, so nothing needs revalidating yet.
      return NextResponse.json(created);
    }
    return NextResponse.json({ error: 'Choose a kind of template.' }, { status: 400 });
  } catch (error) {
    if (error instanceof TemplateAdminError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('template create failed', error);
    return NextResponse.json({ error: 'The template could not be saved.' }, { status: 500 });
  }
}
