import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Box, CirclePlay, Download, Layers3, MoveUpRight, PackageCheck, Sparkles } from "lucide-react";
import { BrandMark } from "./original-brand-mark";
import { PackageBox } from "./original-package-box";
import { Button } from "./original-button";
import { MarketingStickyHeader } from "./site-shell";


export function OriginalHome() {
  return <><main id="main" className="lovable-original marketing-page">
    <nav className="site-nav">
      <BrandMark />
      <div className="original-nav-links"><a href="#workflow">Workflow</a><a href="#showcase">Examples</a><Link href="/blog">Guides</Link><Link href="/faq">FAQ</Link><Link href="/contact">Contact</Link></div>
      <Button asChild size="sm"><Link href="/studio">Open Studio <ArrowRight /></Link></Button>
    </nav>

    <section className="home-hero">
      <div className="hero-copy animate-fade-in">
        <div className="hero-badge"><Sparkles /> Packaging ideas, made tangible</div>
        <h1>Design.<br/><span>Preview.</span> Refine.</h1>
        <p>A focused packaging workspace where you compose artwork on the flat dieline, then see that exact layout wrapped onto the folded 3D package.</p>
        <div className="hero-actions"><Button asChild size="lg"><Link href="/studio">Start designing <ArrowRight /></Link></Button><Button variant="outline" size="lg" asChild><a href="#workflow"><CirclePlay /> Watch the flow</a></Button></div>
        <div className="hero-proof"><span>Built for real packaging work</span><i/><span>No install</span><i/><span>Runs in your browser</span></div>
      </div>
      <div className="hero-stage" role="img" aria-label="Illustrative studio concept showing a package, artwork inspector, and proposed sharing workflow">
        <div className="hero-window">
          <div className="hero-window-bar"><div className="original-window-title"><span className="window-logo"><Box /></span><b>Noma Tea — Spring</b><span className="saved-dot">Local</span></div><span className="window-share"><Download/> Export</span></div>
          <div className="hero-window-body">
            <div className="mini-tools">{[Box,Layers3,Sparkles,PackageCheck].map((Icon,i)=><span key={i} className={i===0?"is-active":""}><Icon/></span>)}</div>
            <div className="hero-canvas"><div className="viewport-grid"/><PackageBox open /></div>
            <div className="mini-inspector"><p>ARTWORK</p><h3>Front face</h3><div className="mini-art"><span>NOMA</span></div><div className="mini-label"><span>Placement</span><b>Fill</b></div><div className="mini-slider"><i/></div><div className="mini-label"><span>Print quality</span><b className="quality">Excellent</b></div></div>
          </div>
        </div>
        <div className="floating-note note-top"><span className="note-icon"><Layers3/></span><span><b>Soft touch</b><small>Material applied</small></span></div>
        <div className="floating-note note-bottom"><span className="avatar-stack"><i>3D</i></span><span><b>Ready to export</b><small>PNG preview</small></span></div>
      </div>
    </section>

    <section id="workflow" className="workflow-section"><div className="section-intro"><p className="eyebrow">One calm workflow</p><h2>From idea to “that’s the one.”</h2></div><div className="workflow-grid">{[
      ["01","Compose in 2D","Place, drag, resize, and rotate artwork directly over the flat dieline—like a lightweight packaging canvas."],
      ["02","Map to 3D","Apply that exact 2D composition to the package so each panel carries the correct portion of the artwork."],
      ["03","Review & refine","Fold, rotate, inspect openings and materials, then return to the dieline whenever placement needs another pass."],
    ].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p><MoveUpRight/></article>)}</div></section>

    <section id="showcase" className="showcase-section"><div className="showcase-image"><Image src="/images/lovable-original-still-life.jpg" alt="A white carton, charcoal mailer, and kraft paper box" width={1600} height={1000} sizes="(max-width: 700px) 100vw, 600px"/><span className="image-caption">Materials that feel real, before they are.</span></div><div className="showcase-copy"><p className="eyebrow">Make better calls, earlier</p><h2>See the package—not just the dieline.</h2><p>Move naturally between the flat dieline and the folded package. Position artwork once in 2D, then review how that same composition lands across the finished 3D structure.</p><ul><li><span>01</span>Free-transform artwork on the dieline</li><li><span>02</span>Exact 2D composition mapped to 3D faces</li><li><span>03</span>Materials and opening motion for final review</li></ul><Button variant="outline" asChild><Link href="/studio">Explore the Studio <ArrowRight/></Link></Button></div></section>

    <section className="seo-home-section">
      <div className="seo-home-intro"><p className="eyebrow">2D dieline to 3D packaging workflow</p><h2>Design flat. Review folded.</h2><p>3D Box Studio lets you place artwork directly over a 2D packaging dieline, move and resize it visually, then map that exact composition onto the folded 3D package. Use the Studio for fast visual validation of layout, scale, materials, and opening behavior while production dielines and press proofs remain in your printer or structural CAD workflow.</p></div>
      <div className="seo-home-grid">
        <article><span>01</span><h3>Custom dimensions</h3><p>Preview folding cartons, mailer boxes, product packaging, and custom proportions without being locked to a static mockup template.</p></article>
        <article><span>02</span><h3>Compose on the dieline</h3><p>Upload artwork of any size, then drag, resize, and rotate it over the flat packaging layout before committing it to individual panels.</p></article>
        <article><span>03</span><h3>Map the same layout to 3D</h3><p>Apply the finished 2D composition to the folded package, rotate the model, inspect openings and materials, and catch placement issues earlier.</p></article>
      </div>
      <div className="seo-home-links"><Link href="/blog">Read packaging guides <ArrowRight/></Link><Link href="/faq">3D Box Studio FAQ <ArrowRight/></Link></div>
    </section>

    <section id="details" className="closing-section"><p className="eyebrow">Your next package starts here</p><h2>Make the idea feel real.</h2><Button asChild size="lg"><Link href="/studio">Open 3D Box Studio <ArrowRight/></Link></Button></section>
    <footer><BrandMark/><nav aria-label="Footer navigation"><Link href="/blog">Guides</Link><Link href="/faq">FAQ</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav><span>© 2026 3D Box Studio</span></footer>
  </main><MarketingStickyHeader /></>
}

