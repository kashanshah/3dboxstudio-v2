import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, Info } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import "./marketing-product-page.css";

export type MarketingPageFaq = { question: string; answer: string };
export type MarketingPageSection = { title: string; body: string; bullets?: string[] };

export function MarketingProductPage({
  eyebrow,
  title,
  intro,
  primaryCta = "Open the Studio",
  secondaryHref,
  secondaryLabel,
  sections,
  faqs,
  note,
  heroAside,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  primaryCta?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  sections: MarketingPageSection[];
  faqs: MarketingPageFaq[];
  note?: string;
  heroAside?: ReactNode;
}) {
  return <>
    <SiteHeader />
    <main id="main" className="marketing-product-page">
      <section className={`mpp-hero${heroAside ? " has-aside" : ""}`}>
        <div className="mpp-hero-copy">
          <span className="mpp-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <div className="mpp-actions">
            <Link className="mpp-primary" href="/studio">{primaryCta}<ArrowRight /></Link>
            {secondaryHref && secondaryLabel ? <Link className="mpp-secondary" href={secondaryHref}>{secondaryLabel}</Link> : null}
          </div>
        </div>
        {heroAside ? <div className="mpp-hero-aside">{heroAside}</div> : null}
      </section>

      <section className="mpp-studio-proof">
        <div>
          <span className="mpp-eyebrow">See the real product</span>
          <h2>Explore the actual Studio interface.</h2>
          <p>This embedded view is the working 3D Box Studio—not a concept dashboard. Open it full-screen when you want to edit.</p>
        </div>
        <div className="mpp-frame"><div className="mpp-framebar"><span/><span/><span/><b>3D Box Studio</b><Link href="/studio">Open full Studio <ArrowRight/></Link></div><iframe src="/studio" title="Actual 3D Box Studio interface" loading="lazy" /></div>
      </section>

      <section className="mpp-sections">
        {sections.map((section,index)=><article key={section.title}>
          <span>{String(index+1).padStart(2,"0")}</span>
          <div><h2>{section.title}</h2><p>{section.body}</p>{section.bullets?.length ? <ul>{section.bullets.map(item=><li key={item}><CheckCircle2 />{item}</li>)}</ul> : null}</div>
        </article>)}
      </section>

      {note ? <section className="mpp-note"><Info/><div><b>Important limitation</b><p>{note}</p></div></section> : null}

      <section className="mpp-faq">
        <span className="mpp-eyebrow">Frequently asked questions</span>
        <h2>Direct answers before you start.</h2>
        <div>{faqs.map(item=><article key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></article>)}</div>
      </section>

      <section className="mpp-bottom">
        <h2>Ready to see your packaging in 3D?</h2>
        <p>Choose a structure, set the size, add artwork, and review the result in your browser.</p>
        <Link className="mpp-primary" href="/studio">Open 3D Box Studio <ArrowRight /></Link>
      </section>
    </main>
    <SiteFooter />
  </>;
}
