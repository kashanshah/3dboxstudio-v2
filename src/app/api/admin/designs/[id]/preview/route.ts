import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/server/admin/auth';
import { getDesignPreviewSource } from '@/server/admin/catalog';
import { presignedReadUrl } from '@/server/media-assets';

type Params = { params: Promise<{ id: string }> };

function dataUrlBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!bytes.length) return null;
  return { bytes, contentType: match[1].toLowerCase() };
}

export async function GET(_req: Request, { params }: Params) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await params;
  try {
    const source = await getDesignPreviewSource(id);
    if (!source) return new NextResponse('Not found', { status: 404 });
    // A stored preview loads straight from S3; only an inline (data URL)
    // preview is sent from here.
    if (!('dataUrl' in source)) {
      return NextResponse.redirect(await presignedReadUrl(source.storageKey), { status: 302, headers: { 'Cache-Control': 'private, max-age=600' } });
    }
    const image = dataUrlBytes(source.dataUrl);
    if (!image) return new NextResponse('Not found', { status: 404 });
    const body = image.bytes.buffer.slice(image.bytes.byteOffset, image.bytes.byteOffset + image.bytes.byteLength) as ArrayBuffer;
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': image.contentType || 'image/png',
        'Content-Length': String(image.bytes.byteLength),
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('GET /api/admin/designs/[id]/preview failed:', error);
    return new NextResponse('Could not load preview', { status: 500 });
  }
}
