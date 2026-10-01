import { translate } from '@/lib/i18n';
import type { Metadata } from 'next';
import { OriginalHome } from '@/components/original-home';
import { FAQ_ITEMS, faqAnswerPlainText } from '@/content/faq';
import { site } from '@/lib/site';
import './lovable-original.css';

const title=translate("metadata.home.free_3d_box_designer_packaging_mockup_generator_3d_box_studio");
const description=translate("metadata.home.free_online_3d_box_designer_and_packaging_mockup_generator_explore_packagin");

export const metadata: Metadata = {
  title:{absolute:title},
  description,
  keywords:['3d box designer','3d box maker','free 3d box maker','online box designer','packaging mockup generator','free packaging mockup','3d packaging simulator','carton mockup','folding carton mockup','mailer box mockup','product box mockup','box design software','packaging box designer','pacdora alternative','3d box studio'],
  alternates:{canonical:'/',languages:{en:'/',fr:'/fr',es:'/es',de:'/de','x-default':'/'}},
  openGraph:{title,description,type:'website',url:'/'},
  twitter:{card:'summary_large_image',title,description}
};

export default function Home() {
  const origin=site.url.toString().replace(/\/$/,'');
  const schema={'@context':'https://schema.org','@graph':[
    {'@type':'WebSite',name:'3D Box Studio',alternateName:['3D Box Maker','Free Packaging Mockup Generator'],description,url:origin+'/'},
    {'@type':'WebApplication',name:'3D Box Studio',alternateName:'Free 3D Box Designer',applicationCategory:'DesignApplication',operatingSystem:'Any',browserRequirements:'Requires JavaScript. WebGL recommended.',offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},description,url:origin+'/studio',featureList:['Packaging template browser','Custom finished dimensions and units','2D dieline artwork workspace','Artwork layers and transforms','Live 2D-to-3D preview','Open and close simulation','Interactive camera and orbit controls','Project saving and reopening','Shareable preview links','PNG export']},
    {'@type':'FAQPage',mainEntity:FAQ_ITEMS.slice(0,8).map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:faqAnswerPlainText(item.answer)}}))}
  ]};
  return <><OriginalHome/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
