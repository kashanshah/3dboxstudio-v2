import { inlineContentDisposition } from '@/server/media-response-headers';
import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/server/admin/auth';
import { getAdminDesignLegacyMedia } from '@/server/admin/catalog';
import { readStoredObject, contentLengthHeader } from '@/server/media-assets';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string; face: string }> };

export async function GET(_req: Request, { params }: Params) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id, face } = await params;
  try {
    const meta = await getAdminDesignLegacyMedia(id, face);
    if (!meta) return new NextResponse('Not found', { status: 404 });
    const object = await readStoredObject(meta.storageKey);
    if (!object) return new NextResponse('Not found', { status: 404 });
    return new NextResponse(object.body, {
      status: 200,
      headers: {
        'Content-Type': meta.mime || object.contentType || 'image/png',
        ...contentLengthHeader(object.byteSize),
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': inlineContentDisposition(meta.name),
        'X-Content-Type-Options': 'nosniff',
        ...(meta.mime === 'image/svg+xml' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
      },
    });
  } catch (error) {
    console.error('admin design legacy media read failed', error);
    return new NextResponse('Could not load artwork', { status: 502 });
  }
}
