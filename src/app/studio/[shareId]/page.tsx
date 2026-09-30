import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicShare } from '@/server/design-shares';
import { SharedDesignViewer } from '@/components/studio/shared-design-viewer';

export async function generateMetadata({params}:{params:Promise<{shareId:string}>}):Promise<Metadata>{
  const {shareId}=await params;
  const share=await getPublicShare(shareId);
  if(!share)return {};
  return {
    title:{absolute:`${share.name} | 3D Box Studio`},
    description:'Interactive 3D packaging design shared from 3D Box Studio.',
    robots:{index:false,follow:false},
  };
}

export default async function SharedDesignPage({params}:{params:Promise<{shareId:string}>}){
  const {shareId}=await params;
  const share=await getPublicShare(shareId);
  if(!share)notFound();
  return <SharedDesignViewer name={share.name} state={share.state} legacy={share.legacy}/>;
}
