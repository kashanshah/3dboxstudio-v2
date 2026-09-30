import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { listMediaAssets, uploadMediaAsset } from '@/server/media-assets';

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
    return NextResponse.json({asset},{status:201});
  }catch(error){
    console.error('media upload failed',error);
    return NextResponse.json({error:error instanceof Error?error.message:'Could not upload artwork.'},{status:400});
  }
}
