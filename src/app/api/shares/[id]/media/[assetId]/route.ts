import { NextResponse } from 'next/server';
import { getShareMedia } from '@/server/design-shares';
import { readStoredObject } from '@/server/media-assets';

export const runtime='nodejs';

export async function GET(_req:Request,{params}:{params:Promise<{id:string;assetId:string}>}){
  const {id,assetId}=await params;
  try{
    const media=await getShareMedia(id,assetId);
    if(!media)return new NextResponse('Not found',{status:404});
    const object=await readStoredObject(media.storage_key);
    if(!object)return new NextResponse('Not found',{status:404});
    const body=object.bytes.buffer.slice(object.bytes.byteOffset,object.bytes.byteOffset+object.bytes.byteLength) as ArrayBuffer;
    return new NextResponse(body,{status:200,headers:{
      'Content-Type':media.mime_type,
      'Content-Length':String(object.bytes.byteLength),
      'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Disposition':`inline; filename="${media.name.replace(/["\\]/g,'_')}"`,
      'X-Content-Type-Options':'nosniff',
      'Cross-Origin-Resource-Policy':'same-origin',
      ...(media.mime_type==='image/svg+xml'?{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}:{}),
    }});
  }catch(error){
    console.error('share media read failed',error);
    return new NextResponse('Could not load artwork',{status:500});
  }
}
