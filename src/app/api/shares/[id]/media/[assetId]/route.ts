import { inlineContentDisposition } from '@/server/media-response-headers';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getShareMedia } from '@/server/design-shares';
import { isShareUnlocked, unlockCookieName } from '@/server/client-shares';
import { readStoredObject, contentLengthHeader } from '@/server/media-assets';

export const runtime='nodejs';

export async function GET(_req:Request,{params}:{params:Promise<{id:string;assetId:string}>}){
  const {id,assetId}=await params;
  try{
    const media=await getShareMedia(id,assetId);
    if(!media)return new NextResponse('Not found',{status:404});
    // The owner's logo is their public brand: the password page shows it too.
    const unlocked=assetId===media.brand_logo_asset_id||isShareUnlocked(id,media.password_hash,(await cookies()).get(unlockCookieName(id))?.value);
    if(!unlocked)return new NextResponse('Not found',{status:404});
    const object=await readStoredObject(media.storage_key);
    if(!object)return new NextResponse('Not found',{status:404});
    return new NextResponse(object.body,{status:200,headers:{
      'Content-Type':media.mime_type,
      ...contentLengthHeader(object.byteSize),
      'Cache-Control':media.password_hash?'private, max-age=3600':'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Disposition': inlineContentDisposition(media.name),
      'X-Content-Type-Options':'nosniff',
      'Cross-Origin-Resource-Policy':'same-origin',
      ...(media.mime_type==='image/svg+xml'?{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}:{}),
    }});
  }catch(error){
    console.error('share media read failed',error);
    return new NextResponse('Could not load artwork',{status:500});
  }
}
