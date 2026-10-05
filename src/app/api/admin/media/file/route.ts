import { inlineContentDisposition } from '@/server/media-response-headers';
import { NextResponse } from 'next/server';
import { storageKeyFromMediaFileId } from '@/lib/admin-media';
import { requireAdminApi } from '@/server/admin/auth';
import { findListedMedia } from '@/server/admin/catalog';
import { readStoredObject, contentLengthHeader } from '@/server/media-assets';

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
    return new NextResponse(object.body, {
      status: 200,
      headers: {
        'Content-Type': mime || 'application/octet-stream',
        ...contentLengthHeader(object.byteSize),
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': inlineContentDisposition(listed.name),
        'X-Content-Type-Options': 'nosniff',
        ...(mime === 'image/svg+xml' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
      },
    });
  } catch (error) {
    console.error('admin media read failed', error);
    return new NextResponse('Could not load image', { status: 502 });
  }
}
