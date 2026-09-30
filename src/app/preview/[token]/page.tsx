import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLegacyPreviewShare } from '@/server/design-shares';
import { SharedDesignViewer } from '@/components/studio/shared-design-viewer';

export async function generateMetadata({params}:{params:Promise<{token:string}>}):Promise<Metadata>{
  const {token}=await params;
  const share=await getLegacyPreviewShare(token);
  if(!share)return {};
  return {title:{absolute:`${share.name} | 3D Box Studio`},description:'Interactive 3D packaging design shared from 3D Box Studio.',robots:{index:false,follow:false}};
}

export default async function LegacyPreviewPage({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  const share=await getLegacyPreviewShare(token);
  if(!share)notFound();
  return <SharedDesignViewer name={share.name} state={share.state} legacy/>;
}
