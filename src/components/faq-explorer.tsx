'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FaqCategoryId, FaqItem } from '@/content/faq';

type Category = { id: FaqCategoryId; label: string };

export function FaqExplorer({ items, categories }: { items: FaqItem[]; categories: Category[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(needle));
  }, [items, query]);

  return <>
    <div className="faq-search"><Search aria-hidden="true"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search artwork, export, dimensions…" aria-label="Search frequently asked questions" /></div>
    <div className="faq-layout">
      <nav className="faq-categories" aria-label="FAQ categories">{categories.map((category) => <a key={category.id} href={`#faq-${category.id}`}>{category.label}</a>)}</nav>
      <div>
        {categories.map((category) => {
          const group = filtered.filter((item) => item.category === category.id);
          if (!group.length) return null;
          return <section className="faq-group" id={`faq-${category.id}`} key={category.id}><h2>{category.label}</h2><p>Answers about {category.label.toLowerCase()} in 3D Box Studio.</p><div className="faq-list">{group.map((item) => <details key={item.id}><summary>{item.question}</summary><p dangerouslySetInnerHTML={{ __html: item.answer }} /></details>)}</div></section>;
        })}
        {filtered.length === 0 ? <p className="faq-empty">No matching answers. Try a broader search.</p> : null}
      </div>
    </div>
  </>;
}
