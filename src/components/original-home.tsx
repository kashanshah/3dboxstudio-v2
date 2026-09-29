import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Box, CirclePlay, Layers3, MoveUpRight, PackageCheck, Share2, Sparkles } from "lucide-react";
import { BrandMark } from "./original-brand-mark";
import { PackageBox } from "./original-package-box";
import { Button } from "./original-button";


export function OriginalHome() {
  return <main id="main" className="lovable-original marketing-page">
    <nav className="site-nav">
      <BrandMark />
      <div className="original-nav-links"><a href="#workflow">Workflow</a><a href="#showcase">Examples</a><a href="#details">Details</a></div>
      <Button asChild size="sm"><Link href="/studio">Open Studio <ArrowRight /></Link></Button>
    </nav>

    <section className="home-hero">
      <div className="hero-copy animate-fade-in">
        <div className="hero-badge"><Sparkles /> Packaging ideas, made tangible</div>
        <h1>Design.<br/><span>Preview.</span> Share.</h1>
        <p>A focused 3D workspace for packaging teams who want to move from flat artwork to confident decisions—fast.</p>
        <div className="hero-actions"><Button asChild size="lg"><Link href="/studio">Start designing <ArrowRight /></Link></Button><Button variant="outline" size="lg" asChild><a href="#workflow"><CirclePlay /> Watch the flow</a></Button></div>
        <div className="hero-proof"><span>Built for real packaging work</span><i/><span>No install</span><i/><span>Shareable in seconds</span></div>
      </div>
      <div className="hero-stage" role="img" aria-label="Illustrative studio concept showing a package, artwork inspector, and proposed sharing workflow">
        <div className="hero-window">
          <div className="hero-window-bar"><div className="original-window-title"><span className="window-logo"><Box /></span><b>Noma Tea — Spring</b><span className="saved-dot">Saved</span></div><span className="window-share"><Share2/> Share</span></div>
          <div className="hero-window-body">
            <div className="mini-tools">{[Box,Layers3,Sparkles,PackageCheck].map((Icon,i)=><span key={i} className={i===0?"is-active":""}><Icon/></span>)}</div>
            <div className="hero-canvas"><div className="viewport-grid"/><PackageBox open /></div>
            <div className="mini-inspector"><p>ARTWORK</p><h3>Front face</h3><div className="mini-art"><span>NOMA</span></div><div className="mini-label"><span>Placement</span><b>Fill</b></div><div className="mini-slider"><i/></div><div className="mini-label"><span>Print quality</span><b className="quality">Excellent</b></div></div>
          </div>
        </div>
        <div className="floating-note note-top"><span className="note-icon"><Layers3/></span><span><b>Soft touch</b><small>Material applied</small></span></div>
        <div className="floating-note note-bottom"><span className="avatar-stack"><i>SK</i><i>AM</i></span><span><b>Ready to review</b><small>2 collaborators</small></span></div>
      </div>
    </section>

    <section id="workflow" className="workflow-section"><div className="section-intro"><p className="eyebrow">One calm workflow</p><h2>From idea to “that’s the one.”</h2></div><div className="workflow-grid">{[
      ["01","Design","Place artwork face by face. Tune dimensions and materials without losing your flow."],
      ["02","Preview","Inspect every angle in a realistic scene. Open, rotate, and refine with confidence."],
      ["03","Share","Send a clean review link or export polished visuals for the next conversation."],
    ].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p><MoveUpRight/></article>)}</div></section>

    <section id="showcase" className="showcase-section"><div className="showcase-image"><Image src="/images/lovable-original-still-life.jpg" alt="A white carton, charcoal mailer, and kraft paper box" width={1600} height={1000} sizes="(max-width: 700px) 100vw, 600px"/><span className="image-caption">Materials that feel real, before they are.</span></div><div className="showcase-copy"><p className="eyebrow">Make better calls, earlier</p><h2>See the package—not just the dieline.</h2><p>Move naturally between structure, artwork, material, and opening behavior in a workspace that keeps the object at the center.</p><ul><li><span>01</span>Artwork organized by face</li><li><span>02</span>Materials with believable character</li><li><span>03</span>Opening motion you can direct</li></ul><Button variant="outline" asChild><Link href="/studio">Explore the Studio <ArrowRight/></Link></Button></div></section>

    <section id="details" className="closing-section"><p className="eyebrow">Your next package starts here</p><h2>Make the idea feel real.</h2><Button asChild size="lg"><Link href="/studio">Open 3D Box Studio <ArrowRight/></Link></Button></section>
    <footer><BrandMark/><span>Designed for packaging teams.</span><span>© 2026 3D Box Studio</span></footer>
  </main>
}

