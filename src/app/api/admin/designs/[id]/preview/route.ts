import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/server/admin/auth';
import { getDesignPreviewSource } from '@/server/admin/catalog';
import { readStoredObject } from '@/server/media-assets';

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
    const image = 'dataUrl' in source ? dataUrlBytes(source.dataUrl) : await readStoredObject(source.storageKey).then((object) => object ? { bytes: object.bytes, contentType: object.contentType || 'image/png' } : null);
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
