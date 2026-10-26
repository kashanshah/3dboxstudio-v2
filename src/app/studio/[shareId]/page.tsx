import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { countShareView, getPublicShare } from '@/server/design-shares';
import { isShareUnlocked, unlockCookieName } from '@/server/client-shares';
import { SharedDesignViewer } from '@/components/studio/shared-design-viewer';
import { ShareUnlockForm } from '@/components/studio/share-unlock-form';
import { jsonDefinitionFor } from '@/server/templates';

export async function generateMetadata({params}:{params:Promise<{shareId:string}>}):Promise<Metadata>{
  const {shareId}=await params;
  const share=await getPublicShare(shareId,false);
  if(!share)return {};
  // A password-protected share keeps even its name private until unlocked;
  // a branded one leaves 3D Box Studio out of the title.
  const locked=!isShareUnlocked(share.id,share.passwordHash,(await cookies()).get(unlockCookieName(share.id))?.value);
  const title=locked?'Shared design':share.brand?(share.brand.name?`${share.name} | ${share.brand.name}`:share.name):`${share.name} | 3D Box Studio`;
  return {
    title:{absolute:title},
    description:share.brand||share.passwordHash?'Interactive 3D packaging design.':'Interactive 3D packaging design shared from 3D Box Studio.',
    robots:{index:false,follow:false},
  };
}

export default async function SharedDesignPage({params}:{params:Promise<{shareId:string}>}){
  const {shareId}=await params;
  const share=await getPublicShare(shareId,false);
  if(!share)notFound();
  const unlocked=isShareUnlocked(share.id,share.passwordHash,(await cookies()).get(unlockCookieName(share.id))?.value);
  if(!unlocked)return <ShareUnlockForm shareId={share.id} brand={share.brand}/>;
  await countShareView(share.id);
  return <SharedDesignViewer name={share.name} state={share.state} templateDefinition={await jsonDefinitionFor(share.state.templateId)} legacy={share.legacy} brand={share.brand}/>;
}
