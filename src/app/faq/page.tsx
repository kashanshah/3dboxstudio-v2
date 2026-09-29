import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { FAQ_CATEGORIES, FAQ_ITEMS, FAQ_PAGE_DESCRIPTION, FAQ_PAGE_TITLE, getCategoryLabel, faqAnswerPlainText } from '@/content/faq';

export const metadata: Metadata = {
  title: { absolute: FAQ_PAGE_TITLE },
  description: FAQ_PAGE_DESCRIPTION,
  alternates: { canonical: '/faq' },
  openGraph: { title: FAQ_PAGE_TITLE, description: FAQ_PAGE_DESCRIPTION, url: '/faq', type: 'website' },
};

export default function FaqPage() {
  const schema = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: faqAnswerPlainText(item.answer) } })),
  };
  return <><SiteHeader/><main id="main" className="section seo-static-page"><span className="eyebrow">HELP & ANSWERS</span><h1>Frequently asked questions.</h1><p className="page-intro">{FAQ_PAGE_DESCRIPTION}</p>
    {FAQ_CATEGORIES.map((category) => <section className="faq-group" key={category.id}><h2>{getCategoryLabel(category.id)}</h2><div className="faq-list">{FAQ_ITEMS.filter((item) => item.category === category.id).map((item) => <details key={item.id}><summary>{item.question}</summary><p dangerouslySetInnerHTML={{__html:item.answer}}/></details>)}</div></section>)}
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
  </main><SiteFooter/></>;
}
