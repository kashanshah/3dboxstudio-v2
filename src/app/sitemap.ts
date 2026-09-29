import type { MetadataRoute } from 'next';
import { BLOG_POSTS } from '@/content/blogPosts';
import { site } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const url=(path:string)=>new URL(path,site.url).toString();
  const alternates=(map:Record<string,string>)=>({languages:Object.fromEntries(Object.entries(map).map(([lang,path])=>[lang,url(path)]))});
  const homeLangs={en:'/',fr:'/fr',es:'/es',de:'/de','x-default':'/'};
  const studioLangs={en:'/studio',fr:'/fr/studio',es:'/es/studio',de:'/de/studio','x-default':'/studio'};
  const staticRoutes:MetadataRoute.Sitemap=[
    {url:url('/'),changeFrequency:'weekly',priority:1,alternates:alternates(homeLangs)},
    {url:url('/fr'),changeFrequency:'weekly',priority:.8,alternates:alternates(homeLangs)},
    {url:url('/es'),changeFrequency:'weekly',priority:.8,alternates:alternates(homeLangs)},
    {url:url('/de'),changeFrequency:'weekly',priority:.8,alternates:alternates(homeLangs)},
    {url:url('/studio'),changeFrequency:'weekly',priority:.95,alternates:alternates(studioLangs)},
    {url:url('/fr/studio'),changeFrequency:'weekly',priority:.75,alternates:alternates(studioLangs)},
    {url:url('/es/studio'),changeFrequency:'weekly',priority:.75,alternates:alternates(studioLangs)},
    {url:url('/de/studio'),changeFrequency:'weekly',priority:.75,alternates:alternates(studioLangs)},
    {url:url('/faq'),changeFrequency:'monthly',priority:.7},
    {url:url('/contact'),changeFrequency:'monthly',priority:.5},
    {url:url('/blog'),changeFrequency:'weekly',priority:.8},
  ];
  const blogRoutes:MetadataRoute.Sitemap=BLOG_POSTS.map(post=>{
    const languages:Record<string,string>={en:`/blog/${post.slug}`,'x-default':`/blog/${post.slug}`};
    if(post.slug==='how-to-create-3d-product-box-mockup-online') languages.fr=`/fr/blog/${post.slug}`;
    return {url:url(`/blog/${post.slug}`),lastModified:new Date(post.updated??post.published),changeFrequency:'monthly',priority:.7,alternates:alternates(languages)};
  });
  blogRoutes.push({url:url('/fr/blog/how-to-create-3d-product-box-mockup-online'),lastModified:new Date('2026-09-07'),changeFrequency:'monthly',priority:.65,alternates:alternates({en:'/blog/how-to-create-3d-product-box-mockup-online',fr:'/fr/blog/how-to-create-3d-product-box-mockup-online','x-default':'/blog/how-to-create-3d-product-box-mockup-online'})});
  return [...staticRoutes,...blogRoutes];
}
