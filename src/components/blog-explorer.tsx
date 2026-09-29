'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useMemo, useState } from 'react';

type Article = {
  slug: string;
  title: string;
  description: string;
  category: string;
  readMinutes: number;
  image: string;
};

export function BlogExplorer({ articles, categories }: { articles: Article[]; categories: string[] }) {
  const [active, setActive] = useState('All');
  const filtered = useMemo(() => active === 'All' ? articles : articles.filter((article) => article.category === active), [active, articles]);
  const featured = filtered[0];
  const rest = filtered.slice(1);

  return <>
    {featured ? <article className="journal-feature">
      <Link className="journal-feature-media" href={`/blog/${featured.slug}`}><img src={featured.image} alt="" width="1200" height="800" /></Link>
      <div className="journal-feature-copy">
        <div>
          <div className="content-article-meta"><span>{featured.category}</span><span>{featured.readMinutes} min read</span></div>
          <h2><Link href={`/blog/${featured.slug}`}>{featured.title}</Link></h2>
          <p>{featured.description}</p>
        </div>
        <Link className="content-text-link" href={`/blog/${featured.slug}`}>Read featured guide <ArrowUpRight size={16}/></Link>
      </div>
    </article> : null}

    <section className="journal-feed" id="all-guides">
      <div className="feed-heading"><h2>All guides</h2><div className="category-filter" aria-label="Filter articles by category">
        {['All', ...categories].map((category) => <button key={category} type="button" className={active === category ? 'is-active' : ''} onClick={() => setActive(category)}>{category}</button>)}
      </div></div>
      <div className="content-article-grid">
        {rest.map((article) => <article className="content-article-card" key={article.slug}><Link href={`/blog/${article.slug}`}>
          <div className="content-article-card-media"><img loading="lazy" src={article.image} alt="" width="1200" height="800" /></div>
          <div className="content-article-meta"><span>{article.category}</span><span>{article.readMinutes} min read</span></div>
          <h3>{article.title}</h3><p>{article.description}</p>
        </Link></article>)}
      </div>
    </section>
  </>;
}
