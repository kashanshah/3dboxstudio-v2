import { NextResponse } from 'next/server';
import { getLegacyDesignThumbnail } from '@/server/design-shares';
import { readStoredObject, contentLengthHeader } from '@/server/media-assets';

export const runtime='nodejs';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 try{
  const meta=await getLegacyDesignThumbnail(id);
  if(!meta)return new NextResponse('Not found',{status:404});
  const object=await readStoredObject(meta.storageKey);
  if(!object)return new NextResponse('Not found',{status:404});
  return new NextResponse(object.body,{status:200,headers:{
   'Content-Type':object.contentType||'image/png',
   ...contentLengthHeader(object.byteSize),
   'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400',
   'Content-Disposition':'inline',
   'X-Content-Type-Options':'nosniff',
   'Cross-Origin-Resource-Policy':'same-origin',
  }});
 }catch(error){
  console.error('legacy design thumbnail read failed',error);
  return new NextResponse('Could not load preview',{status:500});
 }
}
