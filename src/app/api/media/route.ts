import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { createMediaUpload, finalizeMediaUpload, listMediaAssets, uploadMediaAsset } from '@/server/media-assets';
import { captureServerEvent,captureServerException } from '@/lib/posthog-server';
import { emitPostHogLog } from '@/lib/posthog-logs';
import { ArtworkUploadError } from '@/lib/artwork-upload';

function uploadErrorResponse(error:unknown){
  const code=error instanceof ArtworkUploadError?error.code:'failed';
  return NextResponse.json({error:error instanceof Error?error.message:'Could not upload artwork.',code},{status:400});
}

export const runtime='nodejs';

export async function GET(){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in to view your image library.'},{status:401});
  try{
    return NextResponse.json({assets:await listMediaAssets(user.id)});
  }catch(error){
    console.error('media list failed',error);
    return NextResponse.json({error:'Could not load your image library.'},{status:500});
  }
}

export async function PUT(req:Request){
  const denied=guardAuthAction(req,'media-upload',60,5*60_000);
  if(denied)return denied;
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in to upload artwork.'},{status:401});
  try{
    const input=await req.json() as {action?:string;id?:string;key?:string;name?:string;mimeType?:string;byteSize?:number;width?:number|null;height?:number|null;fingerprint?:string|null};
    if(input.action==='prepare'){
      const upload=await createMediaUpload(user.id,{
        name:String(input.name||'artwork'),mimeType:String(input.mimeType||''),byteSize:Number(input.byteSize||0),
        width:input.width,height:input.height,fingerprint:typeof input.fingerprint==='string'?input.fingerprint:null,
      });
      return NextResponse.json(upload);
    }
    if(input.action==='finalize'){
      if(!input.id||!input.key)return NextResponse.json({error:'Upload details are incomplete.'},{status:400});
      const {asset,existing}=await finalizeMediaUpload(user.id,{
        id:input.id,key:input.key,name:String(input.name||'artwork'),mimeType:String(input.mimeType||''),
        byteSize:Number(input.byteSize||0),width:input.width,height:input.height,
      });
      const mimeType=asset.mimeType,byteSize=Number(input.byteSize||0);
      await captureServerEvent(user.id,'artwork_uploaded',{upload_method:'direct',mime_type:mimeType,byte_size:byteSize,deduplicated:existing});
      emitPostHogLog('Artwork upload completed',{event:'artwork.upload',posthogDistinctId:user.id,upload_method:'direct',mime_type:mimeType,byte_size:byteSize,status:'success',deduplicated:existing});
      // 200 + existing:true tells the client this is an asset it may already show.
      return NextResponse.json({asset,existing},{status:existing?200:201});
    }
    return NextResponse.json({error:'Unknown media upload action.'},{status:400});
  }catch(error){
    console.error('direct media upload failed',error);
    await captureServerException(error,user.id);
    return uploadErrorResponse(error);
  }
}

export async function POST(req:Request){
  const denied=guardAuthAction(req,'media-upload',30,5*60_000);
  if(denied)return denied;
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Sign in to upload artwork.'},{status:401});

  try{
    const form=await req.formData();
    const file=form.get('file');
    if(!(file instanceof File))return NextResponse.json({error:'Choose an image to upload.'},{status:400});
    const width=Number(form.get('width'));
    const height=Number(form.get('height'));
    const asset=await uploadMediaAsset(user.id,file,{
      width:Number.isFinite(width)&&width>0?width:null,
      height:Number.isFinite(height)&&height>0?height:null,
    });
    await captureServerEvent(user.id,'artwork_uploaded',{upload_method:'multipart',mime_type:file.type,byte_size:file.size});
    emitPostHogLog('Artwork upload completed',{event:'artwork.upload',posthogDistinctId:user.id,upload_method:'multipart',mime_type:file.type,byte_size:file.size,status:'success'});
    return NextResponse.json({asset},{status:201});
  }catch(error){
    console.error('media upload failed',error);
    await captureServerException(error,user.id);
    return uploadErrorResponse(error);
  }
}
