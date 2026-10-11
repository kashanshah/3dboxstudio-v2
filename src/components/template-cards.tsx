"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type TemplateCard = { slug: string; name: string; description: string; tags: string[]; image: string; size: string; studioHref: string };

export function TemplateCards({ cards, filters }: { cards: TemplateCard[]; filters: boolean }) {
  const [tag, setTag] = useState<string | null>(null);
  const tags = Array.from(new Set(cards.flatMap(card => card.tags)));
  const shown = tag ? cards.filter(card => card.tags.includes(tag)) : cards;
  return <>
    {filters && <div className="template-card-filters" role="group" aria-label="Filter templates">
      <button type="button" aria-pressed={tag === null} onClick={() => setTag(null)}>All</button>
      {tags.map(name => <button type="button" key={name} aria-pressed={tag === name} onClick={() => setTag(name)}>{name}</button>)}
    </div>}
    <div className="template-card-grid">{shown.map(card => <article className="template-card" key={card.slug}>
      <Link className="template-card-media" href={`/box-templates/${card.slug}`} tabIndex={-1} aria-hidden="true">
        <Image src={card.image} alt="" fill sizes="(max-width: 900px) 90vw, 380px" />
      </Link>
      <div className="template-card-body">
        <span className="template-card-tag">{card.tags[0]}</span>
        <h3><Link href={`/box-templates/${card.slug}`}>{card.name}</Link></h3>
        <p>{card.description}</p>
        <small>Default {card.size} · any size</small>
        <div className="template-card-actions">
          <Link href={`/box-templates/${card.slug}`}>Sizes &amp; dieline <ArrowRight /></Link>
          <Link className="is-primary" href={card.studioHref}>Open in Studio</Link>
        </div>
      </div>
    </article>)}</div>
  </>;
}
