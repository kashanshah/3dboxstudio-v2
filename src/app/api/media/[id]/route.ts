import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { deleteMediaAsset, readMediaAsset } from '@/server/media-assets';

export const runtime='nodejs';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return new NextResponse('Unauthorized',{status:401});
  try{
    const media=await readMediaAsset(user.id,(await params).id);
    if(!media)return new NextResponse('Not found',{status:404});
    const body=media.bytes.buffer.slice(
      media.bytes.byteOffset,
      media.bytes.byteOffset+media.bytes.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(body,{
      status:200,
      headers:{
        'Content-Type':media.row.mime_type,
        'Content-Length':String(media.bytes.byteLength),
        'Cache-Control':'private, max-age=3600, must-revalidate',
        'Content-Disposition':`inline; filename="${media.row.name.replace(/["\\]/g,'_')}"`,
        'X-Content-Type-Options':'nosniff',
        'Cross-Origin-Resource-Policy':'same-origin',
        ...(media.row.mime_type==='image/svg+xml'?{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}:{}),
      },
    });
  }catch(error){
    console.error('media read failed',error);
    return new NextResponse('Could not load artwork',{status:500});
  }
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
  const denied=guardAuthAction(req,'media-delete',30,5*60_000);
  if(denied)return denied;
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in to manage your image library.'},{status:401});

  try{
    const result=await deleteMediaAsset(user.id,(await params).id);
    if(result.deleted)return NextResponse.json({ok:true});
    if(result.reason==='in_use')return NextResponse.json({
      error:'This image is still used by saved designs. Remove or replace it there before deleting it from My Images.',
      usages:result.projects,
    },{status:409});
    return NextResponse.json({error:'Image not found.'},{status:404});
  }catch(error){
    console.error('media delete failed',error);
    return NextResponse.json({error:'Could not delete artwork.'},{status:500});
  }
}
