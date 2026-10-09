import { translate } from '@/lib/i18n';
import type { Metadata } from 'next';
import { StudioShell } from '@/components/studio/studio-shell';
import { SignedInHintRepair } from '@/components/auth/signed-in-hint-repair';
import { redirect,notFound } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { getStudioProject } from '@/server/projects';
import Link from 'next/link';
import { site, defaultOgImage } from '@/lib/site';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';
import { decodeRouteParam } from '@/lib/route-params';
import { listWorkspaceProjects } from '@/server/workspace-projects';
import { editorReturnPath, requestedDimensions } from '@/lib/studio-entry';

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

export default async function Studio({searchParams}:{searchParams:Promise<{project?:string;template?:string;workspace?:string;w?:string;h?:string;d?:string;unit?:string}>}) {
  const params=await searchParams,user=await getCurrentUser();
  const projectId=params.project?decodeRouteParam(params.project):undefined;
  // Keep the template and size picked on a marketing page through sign-in.
  if(!user) redirect(`/login?next=${encodeURIComponent(editorReturnPath(params))}`);
  const project=projectId?await getStudioProject(user.id,projectId):null;
  if(projectId&&!project)notFound();
  const newDesignProjects=project?undefined:(await listWorkspaceProjects(user.id)).map(({id,name,isDefault,designCount})=>({id,name,isDefault,designCount}));
  const requestedTemplate=!project&&params.template?getPackagingTemplate(params.template):null;
  const initialTemplateId=requestedTemplate?.status==='ready'?requestedTemplate.id:undefined;
  const initialDimensions=initialTemplateId&&requestedTemplate?.defaultDimensions?requestedDimensions(params,requestedTemplate.defaultDimensions):undefined;
  const initialUnit=initialTemplateId&&(params.unit==='in'||params.unit==='mm')?params.unit:undefined;
  const schema={'@context':'https://schema.org','@type':'WebApplication',name:'3D Box Studio',alternateName:'Free 3D Box Designer',applicationCategory:'DesignApplication',operatingSystem:'Any',browserRequirements:'Requires JavaScript. WebGL recommended.',offers:{'@type':'Offer',price:'0',priceCurrency:'USD',description:'Free account required'},description,url:new URL('/studio',site.url).toString(),featureList:['Custom box dimensions','Packaging materials','Opening simulation','Per-face artwork upload','Interactive 3D preview','PNG export']};
  return <><StudioShell key={project?.id??`${initialTemplateId??'new'}:${params.workspace??'default'}:${initialDimensions?`${initialDimensions.width}x${initialDimensions.height}x${initialDimensions.depth}`:''}`} initialProject={project??undefined} initialWorkspaceProjectId={params.workspace??project?.workspaceProjectId??undefined} initialTemplateId={initialTemplateId} initialDimensions={initialDimensions} initialUnit={initialUnit} newDesignProjects={newDesignProjects}/><SignedInHintRepair/>{!user.emailVerified&&<div className="editor-verification-reminder"><Link href="/verify-email">Verify your email</Link></div>}<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
