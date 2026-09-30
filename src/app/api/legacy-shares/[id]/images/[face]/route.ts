import { NextResponse } from 'next/server';
import { getLegacyShareImageById } from '@/server/design-shares';
import { readLegacyStoredObject } from '@/server/legacy-media';

export const runtime='nodejs';

export async function GET(_req:Request,{params}:{params:Promise<{id:string;face:string}>}){
 const {id,face}=await params;
 try{
  const meta=await getLegacyShareImageById(id,face);
  if(!meta)return new NextResponse('Not found',{status:404});
  const object=await readLegacyStoredObject(meta.storageKey);
  if(!object)return new NextResponse('Not found',{status:404});
  const body=object.bytes.buffer.slice(object.bytes.byteOffset,object.bytes.byteOffset+object.bytes.byteLength) as ArrayBuffer;
  return new NextResponse(body,{status:200,headers:{
   'Content-Type':meta.mime||object.contentType,
   'Content-Length':String(object.bytes.byteLength),
   'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400',
   'Content-Disposition':`inline; filename="${meta.name.replace(/["\\]/g,'_')}"`,
   'X-Content-Type-Options':'nosniff',
   'Cross-Origin-Resource-Policy':'same-origin',
   ...(meta.mime==='image/svg+xml'?{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}:{}),
  }});
 }catch(error){
  console.error('legacy share image read failed',error);
  return new NextResponse('Could not load artwork',{status:500});
 }
}
