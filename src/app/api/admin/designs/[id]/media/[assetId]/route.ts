import { inlineContentDisposition } from '@/server/media-response-headers';
import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/server/admin/auth';
import { getAdminDesignMedia } from '@/server/admin/catalog';
import { readStoredObject } from '@/server/media-assets';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string; assetId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id, assetId } = await params;
  try {
    const media = await getAdminDesignMedia(id, assetId);
    if (!media) return new NextResponse('Not found', { status: 404 });
    const object = await readStoredObject(media.storage_key);
    if (!object) return new NextResponse('Not found', { status: 404 });
    const body = object.bytes.buffer.slice(object.bytes.byteOffset, object.bytes.byteOffset + object.bytes.byteLength) as ArrayBuffer;
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': media.mime_type || object.contentType || 'application/octet-stream',
        'Content-Length': String(object.bytes.byteLength),
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': inlineContentDisposition(media.name),
        'X-Content-Type-Options': 'nosniff',
        ...(media.mime_type === 'image/svg+xml' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
      },
    });
  } catch (error) {
    console.error('admin design media read failed', error);
    return new NextResponse('Could not load artwork', { status: 502 });
  }
}
