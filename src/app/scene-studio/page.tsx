import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SceneStudio } from '@/components/studio/scene-studio';
import { getCurrentUser } from '@/server/auth/session';
import { getWorkspaceDesigns } from '@/server/projects';

export const metadata:Metadata={
  title:{absolute:'Scene Studio | 3D Box Studio'},
  description:'Build product photography scenes using your saved packaging designs, backgrounds, lighting, shadows, cameras and studio environments.',
  robots:{index:false,follow:false},
};

export default async function SceneStudioPage(){
  const user=await getCurrentUser();
  if(!user) redirect('/login?next=/scene-studio');
  const {designs}=await getWorkspaceDesigns(user.id,'','recent',1);
  return <SceneStudio designs={designs} user={{name:user.name,email:user.email}}/>;
}
