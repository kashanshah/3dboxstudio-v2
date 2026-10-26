import { NextResponse } from 'next/server';
import { contentLengthHeader, readTemplateImage } from '@/server/media-assets';

export const runtime = 'nodejs';

/** A template card picture uploaded in Admin → Templates. Ids are random and never reused, so it caches for good. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const image = await readTemplateImage((await params).id);
    if (!image) return new NextResponse('Not found', { status: 404 });
    return new NextResponse(image.body, {
      status: 200,
      headers: {
        'Content-Type': image.contentType,
        ...contentLengthHeader(image.byteSize),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if ((error as { name?: string })?.name === 'NoSuchKey') return new NextResponse('Not found', { status: 404 });
    console.error('template image read failed', error);
    return new NextResponse('Could not load the picture', { status: 500 });
  }
}
