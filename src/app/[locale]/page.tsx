import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { notFoundMetadata } from '@/lib/not-found-metadata';
import { LocalizedHome } from '@/components/localized-home';
import { homeLanguageAlternates, isLocalizedHomeLocale, localizedHome, localizedHomeLocales } from '@/content/localized-home';
import { site, defaultOgImage } from '@/lib/site';
import '../lovable-original.css';

type Props={params:Promise<{locale:string}>};
export function generateStaticParams(){return localizedHomeLocales.map(locale=>({locale}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {locale}=await params; if(!isLocalizedHomeLocale(locale)) return notFoundMetadata;
 const c=localizedHome[locale];
 return {
  title:{absolute:c.title},
  description:c.description,
  alternates:{canonical:`/${locale}`,languages:homeLanguageAlternates},
  openGraph:{images:[defaultOgImage],title:c.title,description:c.description,type:'website',url:`/${locale}`,locale:c.ogLocale},
  twitter:{card:'summary_large_image',title:c.title,description:c.description,images:[defaultOgImage.url]},
 };
}
export default async function LocalizedHomePage({params}:Props){
 const {locale}=await params; if(!isLocalizedHomeLocale(locale)) notFound();
 const c=localizedHome[locale];
 const origin=site.url.toString().replace(/\/$/,'');
 const schema={'@context':'https://schema.org','@graph':[
  {'@type':'WebPage',name:c.title,description:c.description,url:`${origin}/${locale}`,inLanguage:c.lang},
  {'@type':'WebApplication',name:'3D Box Studio',applicationCategory:'DesignApplication',operatingSystem:'Any',offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},description:c.description,url:`${origin}/studio`,inLanguage:'en'},
  {'@type':'FAQPage',inLanguage:c.lang,mainEntity:c.faq.items.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))},
 ]};
 return <><LocalizedHome locale={locale}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
