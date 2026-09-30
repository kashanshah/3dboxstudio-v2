'use client';

import Link from 'next/link';
import { ArrowUpRight, Search, X } from 'lucide-react';
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
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => articles.filter((article) => {
    const categoryMatch = active === 'All' || article.category === active;
    const searchMatch = !normalizedQuery || [article.title, article.description, article.category]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    return categoryMatch && searchMatch;
  }), [active, articles, normalizedQuery]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    categories.forEach((category) => counts.set(category, 0));
    articles.forEach((article) => counts.set(article.category, (counts.get(article.category) ?? 0) + 1));
    return counts;
  }, [articles, categories]);

  const featured = filtered[0];
  const rest = filtered.slice(1);
  const hasFilters = active !== 'All' || query.length > 0;

  return <div className="blog-explorer-layout">
    <aside className="blog-filter-sidebar" aria-label="Guide filters">
      <div className="blog-filter-sticky">
        <div className="blog-filter-heading">
          <div><span>Browse guides</span><strong>{filtered.length} result{filtered.length === 1 ? '' : 's'}</strong></div>
          {hasFilters && <button type="button" onClick={() => { setActive('All'); setQuery(''); }}>Clear</button>}
        </div>

        <label className="blog-search">
          <Search size={18}/>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search guides"
            aria-label="Search guides"
          />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={15}/></button>}
        </label>

        <div className="blog-category-list" role="group" aria-label="Filter articles by category">
          <button type="button" className={active === 'All' ? 'is-active' : ''} onClick={() => setActive('All')}>
            <span>All guides</span><b>{articles.length}</b>
          </button>
          {categories.map((category) => <button
            key={category}
            type="button"
            className={active === category ? 'is-active' : ''}
            onClick={() => setActive(category)}
          >
            <span>{category}</span><b>{categoryCounts.get(category) ?? 0}</b>
          </button>)}
        </div>
      </div>
    </aside>

    <div className="blog-results">
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
      </article> : <div className="blog-empty-state">
        <Search size={28}/>
        <h2>No guides found</h2>
        <p>Try a different search or category.</p>
        <button type="button" onClick={() => { setActive('All'); setQuery(''); }}>Show all guides</button>
      </div>}

      {featured && <section className="journal-feed" id="all-guides">
        <div className="feed-heading"><h2>{hasFilters ? 'Matching guides' : 'All guides'}</h2><span>{filtered.length} article{filtered.length === 1 ? '' : 's'}</span></div>
        <div className="content-article-grid">
          {rest.map((article) => <article className="content-article-card" key={article.slug}><Link href={`/blog/${article.slug}`}>
            <div className="content-article-card-media"><img loading="lazy" src={article.image} alt="" width="1200" height="800" /></div>
            <div className="content-article-meta"><span>{article.category}</span><span>{article.readMinutes} min read</span></div>
            <h3>{article.title}</h3><p>{article.description}</p>
          </Link></article>)}
        </div>
      </section>}
    </div>
  </div>;
}
