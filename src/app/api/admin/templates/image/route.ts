import { NextResponse } from 'next/server';
import { requireAdminMutation } from '@/server/admin/auth';
import { ArtworkUploadError } from '@/lib/artwork-upload';
import { uploadTemplateImage } from '@/server/media-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A template card picture, stored in S3 with the site's media; returns the URL the template's fields keep. */
export async function POST(req: Request) {
  const denied = await requireAdminMutation(req);
  if (denied) return denied;
  const file = (await req.formData().catch(() => null))?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a picture.' }, { status: 400 });
  try {
    return NextResponse.json({ url: await uploadTemplateImage(file) });
  } catch (error) {
    if (error instanceof ArtworkUploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('template image upload failed', error);
    return NextResponse.json({ error: 'The picture could not be uploaded.' }, { status: 500 });
  }
}
