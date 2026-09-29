import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StudioShell } from '@/components/studio/studio-shell';
import { isMigratedLocale, localeMeta, migratedLocales } from '@/lib/legacy-locales';

type Props={params:Promise<{locale:string}>};
export function generateStaticParams(){return migratedLocales.map(locale=>({locale}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {locale}=await params; if(!isMigratedLocale(locale)) return {};
 const meta=localeMeta[locale];
 return {title:{absolute:meta.studioTitle},description:meta.studioDescription,alternates:{canonical:`/${locale}/studio`,languages:{en:'/studio',fr:'/fr/studio',es:'/es/studio',de:'/de/studio','x-default':'/studio'}},robots:locale==='zh'?{index:false,follow:true}:undefined};
}
export default async function LocalizedStudio({params}:Props){const {locale}=await params;if(!isMigratedLocale(locale))notFound();return <StudioShell/>;}
