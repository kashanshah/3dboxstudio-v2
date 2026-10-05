import { translate } from '@/lib/i18n';
import type { Metadata } from 'next';
import { StudioShell } from '@/components/studio/studio-shell';
import { redirect,notFound } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { getStudioProject } from '@/server/projects';
import Link from 'next/link';
import { site, defaultOgImage } from '@/lib/site';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';
import { decodeRouteParam } from '@/lib/route-params';
import { listWorkspaceProjects } from '@/server/workspace-projects';

const title=translate("metadata.studio.free_3d_box_maker_packaging_mockup_generator_3d_box_studio");
const description=translate("metadata.studio.design_cartons_and_mailer_boxes_in_a_free_online_3d_box_maker_and_packaging");

export const metadata: Metadata = {
  title:{absolute:title},
  robots:{index:false,follow:false},
  description,
  keywords:['3d box designer','3d box maker','free 3d box maker','online box designer','packaging mockup generator','free packaging mockup','3d packaging simulator','carton mockup','folding carton mockup','mailer box mockup','product box mockup','box design software','packaging box designer','pacdora alternative','3d box studio'],
  alternates:{canonical:'/studio'},
  openGraph:{ images:[defaultOgImage],title,description,type:'website',url:'/studio'},
};

export default async function Studio({searchParams}:{searchParams:Promise<{project?:string;template?:string;workspace?:string}>}) {
  const params=await searchParams,user=await getCurrentUser();
  const projectId=params.project?decodeRouteParam(params.project):undefined;
  if(!user) redirect(`/login?next=${encodeURIComponent('/studio/editor'+(projectId?`?project=${encodeURIComponent(projectId)}`:''))}`);
  const project=projectId?await getStudioProject(user.id,projectId):null;
  if(projectId&&!project)notFound();
  const newDesignProjects=project?undefined:(await listWorkspaceProjects(user.id)).map(({id,name,isDefault,designCount})=>({id,name,isDefault,designCount}));
  const requestedTemplate=!project&&params.template?getPackagingTemplate(params.template):null;
  const initialTemplateId=requestedTemplate?.status==='ready'?requestedTemplate.id:undefined;
  const schema={'@context':'https://schema.org','@type':'WebApplication',name:'3D Box Studio',alternateName:'Free 3D Box Designer',applicationCategory:'DesignApplication',operatingSystem:'Any',browserRequirements:'Requires JavaScript. WebGL recommended.',offers:{'@type':'Offer',price:'0',priceCurrency:'USD',description:'Free account required'},description,url:new URL('/studio',site.url).toString(),featureList:['Custom box dimensions','Packaging materials','Opening simulation','Per-face artwork upload','Interactive 3D preview','PNG export']};
  return <><StudioShell key={project?.id??`${initialTemplateId??'new'}:${params.workspace??'default'}`} initialProject={project??undefined} initialWorkspaceProjectId={params.workspace??project?.workspaceProjectId??undefined} initialTemplateId={initialTemplateId} newDesignProjects={newDesignProjects}/>{!user.emailVerified&&<div className="editor-verification-reminder"><Link href="/verify-email">Verify your email</Link></div>}<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
