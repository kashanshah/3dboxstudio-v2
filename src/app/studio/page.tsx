import type { Metadata } from 'next';
import { StudioShell } from '@/components/studio/studio-shell';
import { site } from '@/lib/site';

const title='Free 3D Box Maker & Packaging Mockup Generator | 3D Box Studio';
const description='Design cartons and mailer boxes in a free online 3D box maker and packaging simulator. Set custom dimensions, upload artwork, preview openings and materials, then export PNG mockups or share your design.';

export const metadata: Metadata = {
  title:{absolute:title},
  description,
  keywords:['3d box designer','3d box maker','free 3d box maker','online box designer','packaging mockup generator','free packaging mockup','3d packaging simulator','carton mockup','folding carton mockup','mailer box mockup','product box mockup','box design software','packaging box designer','pacdora alternative','3d box studio'],
  alternates:{canonical:'/studio',languages:{en:'/studio',fr:'/fr/studio',es:'/es/studio',de:'/de/studio','x-default':'/studio'}},
  openGraph:{title,description,type:'website',url:'/studio'},
};

export default function Studio() {
  const schema={'@context':'https://schema.org','@type':'WebApplication',name:'3D Box Studio',alternateName:'Free 3D Box Designer',applicationCategory:'DesignApplication',operatingSystem:'Any',browserRequirements:'Requires JavaScript. WebGL recommended.',offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},description,url:new URL('/studio',site.url).toString(),featureList:['Custom box dimensions','Packaging materials','Opening simulation','Per-face artwork upload','Interactive 3D preview','PNG export']};
  return <><StudioShell/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
