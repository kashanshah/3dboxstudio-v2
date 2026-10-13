import { inlineContentDisposition } from '@/server/media-response-headers';
import { NextResponse } from 'next/server';
import { storageKeyFromMediaFileId } from '@/lib/admin-media';
import { requireAdminApi } from '@/server/admin/auth';
import { findListedMedia } from '@/server/admin/catalog';
import { readStoredObject, contentLengthHeader, presignedReadUrl } from '@/server/media-assets';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const key = storageKeyFromMediaFileId(new URL(req.url).searchParams.get('id') || '');
  if (!key) return new NextResponse('Not found', { status: 404 });
  try {
    const listed = await findListedMedia(key);
    if (!listed) return new NextResponse('Not found', { status: 404 });
    // SVGs are still served from here, with a locked-down policy; every other
    // image loads straight from S3 instead of streaming through this function.
    if (listed.mimeType !== 'image/svg+xml') {
      const mime = listed.mimeType && listed.mimeType !== 'application/octet-stream' ? listed.mimeType : null;
      return NextResponse.redirect(await presignedReadUrl(key, { contentType: mime, fileName: listed.name }), {
        status: 302,
        headers: { 'Cache-Control': 'private, max-age=600' },
      });
    }
    const object = await readStoredObject(key);
    if (!object) return new NextResponse('Not found', { status: 404 });
    const mime = listed.mimeType;
    return new NextResponse(object.body, {
      status: 200,
      headers: {
        'Content-Type': mime,
        ...contentLengthHeader(object.byteSize),
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': inlineContentDisposition(listed.name),
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (error) {
    console.error('admin media read failed', error);
    return new NextResponse('Could not load image', { status: 502 });
  }
}
