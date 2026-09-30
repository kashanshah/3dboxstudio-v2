import { NextResponse } from 'next/server';
import { storageKeyFromMediaFileId } from '@/lib/admin-media';
import { requireAdminApi } from '@/server/admin/auth';
import { findListedMedia } from '@/server/admin/catalog';
import { readStoredObject } from '@/server/media-assets';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const key = storageKeyFromMediaFileId(new URL(req.url).searchParams.get('id') || '');
  if (!key) return new NextResponse('Not found', { status: 404 });
  try {
    const listed = await findListedMedia(key);
    if (!listed) return new NextResponse('Not found', { status: 404 });
    const object = await readStoredObject(key);
    if (!object) return new NextResponse('Not found', { status: 404 });
    const mime = listed.mimeType && listed.mimeType !== 'application/octet-stream' ? listed.mimeType : object.contentType;
    const body = object.bytes.buffer.slice(object.bytes.byteOffset, object.bytes.byteOffset + object.bytes.byteLength) as ArrayBuffer;
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': mime || 'application/octet-stream',
        'Content-Length': String(object.bytes.byteLength),
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename="${listed.name.replace(/["\\]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff',
        ...(mime === 'image/svg+xml' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
      },
    });
  } catch (error) {
    console.error('admin media read failed', error);
    return new NextResponse('Could not load image', { status: 502 });
  }
}
