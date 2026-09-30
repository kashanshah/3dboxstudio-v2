import type { Metadata } from 'next';
import { StudioShell } from '@/components/studio/studio-shell';
import { site } from '@/lib/site';

const title='Free 3D Box Maker & Packaging Mockup Generator | 3D Box Studio';
const description='Design cartons in a browser-based 2D-to-3D packaging workflow. Compose artwork on the flat dieline, drag, resize and rotate it, then map that exact layout onto the folded 3D package for review.';

export const metadata: Metadata = {
  title:{absolute:title},
  description,
  keywords:['3d box designer','3d box maker','free 3d box maker','online box designer','packaging mockup generator','free packaging mockup','3d packaging simulator','carton mockup','folding carton mockup','mailer box mockup','product box mockup','box design software','packaging box designer','pacdora alternative','3d box studio'],
  alternates:{canonical:'/studio',languages:{en:'/studio',fr:'/fr/studio',es:'/es/studio',de:'/de/studio','x-default':'/studio'}},
  openGraph:{title,description,type:'website',url:'/studio'},
};

export default function Studio() {
  const schema={'@context':'https://schema.org','@type':'WebApplication',name:'3D Box Studio',alternateName:'Free 3D Box Designer',applicationCategory:'DesignApplication',operatingSystem:'Any',browserRequirements:'Requires JavaScript. WebGL recommended.',offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},description,url:new URL('/studio',site.url).toString(),featureList:['Custom box dimensions','2D dieline artwork canvas','Free-transform artwork placement','2D composition mapped to 3D panels','Packaging materials','Opening simulation','Interactive 3D preview','PNG export']};
  return <><StudioShell/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
