import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { isMigratedLocale, localeMeta, migratedLocales } from '@/lib/legacy-locales';

type Props={params:Promise<{locale:string}>};
export function generateStaticParams(){return migratedLocales.map(locale=>({locale}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {locale}=await params; if(!isMigratedLocale(locale)) return {};
 const meta=localeMeta[locale];
 return {title:{absolute:meta.homeTitle},description:meta.homeDescription,alternates:{canonical:`/${locale}`,languages:{en:'/',fr:'/fr',es:'/es',de:'/de','x-default':'/'}},robots:locale==='zh'?{index:false,follow:true}:undefined};
}
export default async function LocalizedHome({params}:Props){
 const {locale}=await params; if(!isMigratedLocale(locale)) notFound(); const meta=localeMeta[locale];
 return <><SiteHeader/><main id="main" className="section seo-static-page localized-landing"><span className="eyebrow">3D BOX STUDIO</span><h1>{meta.homeTitle.replace(' | 3D Box Studio','')}</h1><p className="page-intro">{meta.homeDescription}</p><div className="localized-actions"><Link className="button" href={`/${locale}/studio`}>Open Studio <ArrowUpRight size={16}/></Link><Link className="text-link" href="/blog">Packaging guides</Link></div></main><SiteFooter/></>;
}
