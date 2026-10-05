import { inlineContentDisposition } from '@/server/media-response-headers';
import { NextResponse } from 'next/server';
import { getMigratedShareAsset } from '@/server/design-shares';
import { readStoredObject, contentLengthHeader } from '@/server/media-assets';

export const runtime='nodejs';

export async function GET(_req:Request,{params}:{params:Promise<{id:string;face:string}>}){
 const {id,face}=await params;
 try{
  const meta=await getMigratedShareAsset(id,face);
  if(!meta)return new NextResponse('Not found',{status:404});
  const object=await readStoredObject(meta.storageKey);
  if(!object)return new NextResponse('Not found',{status:404});
  return new NextResponse(object.body,{status:200,headers:{
   'Content-Type':meta.mime||object.contentType,
   ...contentLengthHeader(object.byteSize),
   'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400',
   'Content-Disposition': inlineContentDisposition(meta.name),
   'X-Content-Type-Options':'nosniff',
   'Cross-Origin-Resource-Policy':'same-origin',
   ...(meta.mime==='image/svg+xml'?{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}:{}),
  }});
 }catch(error){
  console.error('migrated share artwork read failed',error);
  return new NextResponse('Could not load artwork',{status:500});
 }
}
