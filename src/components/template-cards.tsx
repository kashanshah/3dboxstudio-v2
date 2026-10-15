"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type TemplateCard = { slug: string; name: string; description: string; tags: string[]; image: string; video?: string; size: string; studioHref: string };

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
        {card.video && <FoldClip src={card.video} />}
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
