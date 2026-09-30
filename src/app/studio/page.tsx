import type { Metadata } from 'next';
import { StudioHome,StudioGate } from '@/components/auth/studio-home';
import { getCurrentUser } from '@/server/auth/session';
import { getWorkspaceDesigns } from '@/server/projects';
import { listWorkspaceProjects } from '@/server/workspace-projects';

const title='Free 3D Box Maker & Packaging Mockup Generator | 3D Box Studio';
const description='Design cartons and mailer boxes in a free online 3D box maker and packaging simulator. Set custom dimensions, upload artwork, preview openings and materials, then export PNG mockups or share your design.';

export const metadata: Metadata = {
  title:{absolute:title},
  description,
  keywords:['3d box designer','3d box maker','free 3d box maker','online box designer','packaging mockup generator','free packaging mockup','3d packaging simulator','carton mockup','folding carton mockup','mailer box mockup','product box mockup','box design software','packaging box designer','pacdora alternative','3d box studio'],
  alternates:{canonical:'/studio',languages:{en:'/studio',fr:'/fr/studio',es:'/es/studio',de:'/de/studio','x-default':'/studio'}},
  openGraph:{title,description,type:'website',url:'/studio'},
};

export default async function Studio({searchParams}:{searchParams:Promise<{q?:string;sort?:string;page?:string;workspace?:string}>}) {
 const user=await getCurrentUser();if(!user)return <StudioGate/>;
 const p=await searchParams,search=(p.q??'').slice(0,80),sort=p.sort==='name'?'name':'recent',page=Math.max(1,Math.min(10000,Number.parseInt(p.page??'1',10)||1));
 const projects=await listWorkspaceProjects(user.id);
 const activeProjectId=p.workspace&&projects.some(project=>project.id===p.workspace)?p.workspace:null;
 const result=await getWorkspaceDesigns(user.id,search,sort,page,activeProjectId);
 return <StudioHome user={user} {...result} projects={projects} activeProjectId={activeProjectId} search={search} sort={sort} page={page}/>;
}
