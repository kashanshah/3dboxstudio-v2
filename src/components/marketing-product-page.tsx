import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, Info } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { FaqSection, type FaqSectionItem } from "./faq-section";
import "./marketing-product-page.css";

export type MarketingPageFaq = FaqSectionItem;
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
  scrollHero = false,
  showStudioProof = true,
  heroSecondary,
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
  scrollHero?: boolean;
  showStudioProof?: boolean;
  heroSecondary?: { eyebrow: string; title: string; body: string };
}) {
  return <>
    <SiteHeader />
    <main id="main" className="marketing-product-page">
      <div className={scrollHero ? "mpp-hero-track" : undefined}>
      <section className={`mpp-hero${heroAside ? " has-aside" : ""}${!showStudioProof ? " mpp-hero-combined" : ""}`}>
        <div className="mpp-hero-copy">
          <section className="mpp-hero-primary-copy">
          <span className="mpp-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <div className="mpp-actions">
            <Link className="mpp-primary" href="/studio">{primaryCta}<ArrowRight /></Link>
            {secondaryHref && secondaryLabel ? <Link className="mpp-secondary" href={secondaryHref}>{secondaryLabel}</Link> : null}
          </div>
          </section>
          {heroSecondary ? <section className="mpp-hero-secondary-copy">
            <span className="mpp-eyebrow">{heroSecondary.eyebrow}</span>
            <h2>{heroSecondary.title}</h2>
            <p>{heroSecondary.body}</p>
          </section> : null}
        </div>
        {heroAside ? <div className="mpp-hero-aside">{heroAside}</div> : null}
      </section>

      </div>

      {showStudioProof ? <section className="mpp-studio-proof" tabIndex={scrollHero ? -1 : undefined}>
        <div>
          <span className="mpp-eyebrow">See the real product</span>
          <h2>Explore the actual Studio interface.</h2>
          <p>This embedded view is the working 3D Box Studio—not a concept dashboard. Open it full-screen when you want to edit.</p>
        </div>
        <div className="mpp-frame"><div className="mpp-framebar"><span/><span/><span/><b>3D Box Studio</b><Link href="/studio">Open full Studio <ArrowRight/></Link></div><iframe src="/studio" title="Actual 3D Box Studio interface" loading="lazy" /></div>
      </section> : null}

      <section className="mpp-sections" tabIndex={scrollHero && !showStudioProof ? -1 : undefined}>
        {sections.map((section,index)=><article key={section.title}>
          <span>{String(index+1).padStart(2,"0")}</span>
          <div><h2>{section.title}</h2><p>{section.body}</p>{section.bullets?.length ? <ul>{section.bullets.map(item=><li key={item}><CheckCircle2 />{item}</li>)}</ul> : null}</div>
        </article>)}
      </section>

      {note ? <section className="mpp-note"><Info/><div><b>Important limitation</b><p>{note}</p></div></section> : null}

      <FaqSection
        items={faqs}
        title="Direct answers before you start."
        description="Useful details about this workflow, its current capabilities, and where production validation still matters."
        links={[
          { href: "/faq", label: "Full FAQ" },
          { href: "/blog", label: "Packaging guides" },
        ]}
      />

      <section className="mpp-bottom">
        <h2>Ready to see your packaging in 3D?</h2>
        <p>Choose a structure, set the size, add artwork, and review the result in your browser.</p>
        <Link className="mpp-primary" href="/studio">Open 3D Box Studio <ArrowRight /></Link>
      </section>
    </main>
    <SiteFooter />
  </>;
}
