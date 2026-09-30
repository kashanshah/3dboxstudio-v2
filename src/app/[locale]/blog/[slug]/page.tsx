import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { BlogShareButtons } from '@/components/blog-share-buttons';
import { FR_BLOG_POSTS } from '@/content/blogLocales/fr';
import { getBlogPostBySlug } from '@/content/blogPosts';
import { site } from '@/lib/site';

type Props={params:Promise<{locale:string;slug:string}>};

export function generateStaticParams(){
 return Object.keys(FR_BLOG_POSTS).map(slug=>({locale:'fr',slug}));
}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {locale,slug}=await params;
 if(locale!=='fr') return {};
 const translated=FR_BLOG_POSTS[slug];
 const base=getBlogPostBySlug(slug);
 if(!translated||!base) return {};
 return {
  title:{absolute:translated.seoTitle ?? `${translated.title} | 3D Box Studio`},
  description:translated.description,
  keywords:translated.keywords ?? base.keywords,
  alternates:{canonical:`/fr/blog/${slug}`,languages:{en:`/blog/${slug}`,fr:`/fr/blog/${slug}`,'x-default':`/blog/${slug}`}},
  openGraph:{title:translated.title,description:translated.description,type:'article',url:`/fr/blog/${slug}`,publishedTime:base.published,modifiedTime:base.updated,images:[{url:`/images/blog/${slug}.webp`,width:1200,height:800,alt:translated.imageAlt ?? translated.title}]}
 };
}

function inlineText(text:string){
 const parts=text.split(/(\[[^\]]+\]\(\/[^)]+\))/g);
 return parts.map((part,index)=>{const m=/^\[([^\]]+)\]\((\/[^)]+)\)$/.exec(part);return m?<Link key={index} href={m[2]}>{m[1]}</Link>:part;});
}

export default async function FrenchBlogPost({params}:Props){
 const {locale,slug}=await params;
 if(locale!=='fr') notFound();
 const translated=FR_BLOG_POSTS[slug]; const base=getBlogPostBySlug(slug);
 if(!translated||!base) notFound();
 const canonical=new URL(`/fr/blog/${slug}`,site.url).toString();
 const schema={'@context':'https://schema.org','@type':'Article',headline:translated.title,description:translated.description,datePublished:base.published,dateModified:base.updated??base.published,inLanguage:'fr',mainEntityOfPage:canonical,author:{'@type':'Organization',name:'3D Box Studio'},publisher:{'@type':'Organization',name:'3D Box Studio'},image:new URL(`/images/blog/${slug}.webp`,site.url).toString()};
 return <><SiteHeader/><main id="main" className="article-shell"><article className="article-page">
  <Link className="article-back" href="/blog"><ArrowLeft size={15}/> Tous les guides</Link>
  <div className="article-heading"><span className="eyebrow">GUIDE 3D BOX STUDIO</span><h1>{translated.title}</h1><p>{translated.description}</p><div className="article-meta"><time dateTime={base.published}>{new Date(base.published+'T00:00:00').toLocaleDateString('fr-FR',{year:'numeric',month:'long',day:'numeric'})}</time><span>·</span><span>{base.readMinutes} min</span></div></div>
  <BlogShareButtons title={translated.title} url={canonical} locale="fr"/>
  <img className="article-hero-image" src={`/images/blog/${slug}.webp`} alt={translated.imageAlt??translated.title} width="1200" height="800"/>
  <div className="article-content">{translated.sections.map((section,index)=>{
   if(section.type==='p')return <p key={index}>{inlineText(section.text)}</p>;
   if(section.type==='h2')return <h2 key={index}>{section.text}</h2>;
   if(section.type==='h3')return <h3 key={index}>{section.text}</h3>;
   if(section.type==='ul')return <ul key={index}>{section.items.map(item=><li key={item}>{inlineText(item)}</li>)}</ul>;
   if(section.type==='ol')return <ol key={index}>{section.items.map(item=><li key={item}>{inlineText(item)}</li>)}</ol>;
   if(section.type==='callout')return <aside className="article-callout" key={index}>{inlineText(section.text)}</aside>;
   if(section.type==='cta')return <div className="article-cta" key={index}><Link className="button" href={section.href??'/studio'}>{section.label}<ArrowUpRight size={16}/></Link></div>;
   if(section.type==='faq')return translated.faqs?.length?<section className="article-faq" key={index}>{translated.faqs.map(faq=><details key={faq.question}><summary>{faq.question}</summary><p>{inlineText(faq.answer)}</p></details>)}</section>:null;
   return null;
  })}</div>
 </article><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></main><SiteFooter/></>;
}
