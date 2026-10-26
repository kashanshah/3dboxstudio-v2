"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { matchesTemplateSearch } from "@/lib/template-search";

/**
 * pageHref: the template's own page; templates an admin added have none and
 * link to the generator (generatorHref) instead. image: null draws a plain tile.
 */
export type TemplateCard = { slug: string; pageHref?: string; generatorHref?: string; name: string; description: string; tags: string[]; image: string | null; video?: string; size: string; studioHref: string; /** Prepared by templateSearchText. */ searchText?: string };

export function TemplateCards({ cards, filters }: { cards: TemplateCard[]; filters: boolean }) {
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const tags = Array.from(new Set(cards.flatMap(card => card.tags)));
  const shown = cards.filter(card => (!tag || card.tags.includes(tag)) && matchesTemplateSearch(query, card.searchText ?? ` ${card.name} ${card.description} ${card.tags.join(" ")} `));
  const reset = () => { setQuery(""); setTag(null); };
  return <>
    {filters && <div className="template-card-tools">
      <label className="template-card-search">
        <Search aria-hidden="true" />
        <span className="sr-only">Search box templates</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search templates: mailer, pizza, perfume, FEFCO…" autoComplete="off" />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X aria-hidden="true" /></button>}
      </label>
      <div className="template-card-filters" role="group" aria-label="Filter templates">
        <button type="button" aria-pressed={tag === null} onClick={() => setTag(null)}>All</button>
        {tags.map(name => <button type="button" key={name} aria-pressed={tag === name} onClick={() => setTag(name)}>{name}</button>)}
      </div>
      <p className="template-card-count" role="status">{shown.length === cards.length ? `${cards.length} templates` : `${shown.length} of ${cards.length} templates`}</p>
    </div>}
    {shown.length === 0 && <div className="template-card-empty">
      <p>No template matches {query ? <>&ldquo;{query}&rdquo;</> : "this filter"}{query && tag ? ` in ${tag}` : ""}.</p>
      <button type="button" onClick={reset}>Show all templates</button>
    </div>}
    <div className="template-card-grid">{shown.map(card => {
      const href = card.pageHref ?? card.generatorHref ?? card.studioHref;
      return <article className="template-card" key={card.slug}>
      <Link className="template-card-media" href={href} tabIndex={-1} aria-hidden="true" {...(card.pageHref ? {} : { rel: "nofollow" })}>
        {card.image && <Image src={card.image} alt="" fill sizes="(max-width: 900px) 90vw, 380px" unoptimized={card.image.startsWith("/api/")} />}
        {card.video && <FoldClip src={card.video} />}
      </Link>
      <div className="template-card-body">
        <span className="template-card-tag">{card.tags[0]}</span>
        <h3><Link href={href} {...(card.pageHref ? {} : { rel: "nofollow" })}>{card.name}</Link></h3>
        <p>{card.description}</p>
        <small>Default {card.size} · any size</small>
        <div className="template-card-actions">
          <Link href={card.pageHref ?? card.generatorHref ?? card.studioHref} {...(card.pageHref ? {} : { rel: "nofollow" })}>Sizes &amp; dieline <ArrowRight /></Link>
          <Link className="is-primary" href={card.studioHref} rel="nofollow">Open in Studio</Link>
        </div>
      </div>
    </article>;
    })}</div>
  </>;
}

/**
 * The box folding up, over its picture: on hover it plays and loops, and
 * goes back to the picture when the pointer leaves; on a touch screen it
 * plays once as the card comes into view. Nothing loads until then, and it
 * never plays for people who ask for reduced motion.
 */
function FoldClip({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const video = ref.current;
    const card = video?.closest<HTMLElement>(".template-card");
    if (!video || !card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = (loop: boolean) => {
      if (!video.src) video.src = src;
      video.loop = loop;
      video.currentTime = 0;
      video.play().then(() => setPlaying(true)).catch(() => {});
    };
    const stop = () => { video.pause(); setPlaying(false); };
    if (window.matchMedia("(hover: hover)").matches) {
      const enter = () => start(true);
      card.addEventListener("pointerenter", enter);
      card.addEventListener("pointerleave", stop);
      return () => { card.removeEventListener("pointerenter", enter); card.removeEventListener("pointerleave", stop); };
    }
    const ended = () => setPlaying(false);
    video.addEventListener("ended", ended);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      start(false);
    }, { threshold: 0.7 });
    observer.observe(card);
    return () => { observer.disconnect(); video.removeEventListener("ended", ended); };
  }, [src]);
  return <video ref={ref} className={`template-card-clip${playing ? " is-playing" : ""}`} muted playsInline preload="none" aria-hidden="true" />;
}
