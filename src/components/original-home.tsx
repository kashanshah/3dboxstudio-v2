import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Box, CirclePlay, Download, Layers3, MoveUpRight, PackageCheck,
  Sparkles, Ruler, ImagePlus, Share2, Save, Rotate3D, Scissors, MousePointer2,
  PanelsTopLeft, Camera, FoldVertical, CheckCircle2
} from "lucide-react";
import { BrandMark } from "./original-brand-mark";
import { PackageBox } from "./original-package-box";
import { Button } from "./original-button";
import { SiteHeader } from "./site-shell";

const capabilities = [
  [Ruler, "Set real dimensions", "Work with finished width, height, depth, and units instead of being locked to one static mockup."],
  [Scissors, "Design on the dieline", "Edit artwork on the flat packaging layout, then see the same design update in 3D."],
  [ImagePlus, "Place artwork visually", "Upload, drag, crop, resize, rotate, and organize artwork in layers."],
  [Rotate3D, "Inspect in 3D", "Orbit, zoom, switch camera views, and review how graphics wrap around the finished package."],
  [FoldVertical, "Open and close the box", "Preview folding and opening behavior so the structure is easier to understand before a sample exists."],
  [Download, "Export the result", "Create clean PNG previews for decks, approvals, product planning, and client review."],
];

const useCases = [
  ["Packaging designers", "Move between dieline artwork and 3D without rebuilding a Photoshop mockup after every change."],
  ["Print shops", "Give customers a clearer visual approval layer before the production file reaches press."],
  ["Agencies", "Share a browser preview instead of sending another round of flat screenshots."],
  ["E-commerce brands", "Test proportions, branding, and presentation angles before photography or manufacturing."],
  ["Small businesses", "Create a believable package preview without learning heavyweight structural CAD."],
  ["Client approvals", "Save, reopen, and share the same design so feedback stays attached to one visual source."],
];

export const HOME_FAQS = [
  {
    question: "What is 3D Box Studio?",
    answer: "3D Box Studio is a free browser-based packaging design and visualization workspace. You choose a supported box structure, set finished dimensions, place artwork on the flat layout, inspect the same design in 3D, and export or share the result."
  },
  {
    question: "Can I use custom box dimensions?",
    answer: "Yes. Supported structures can be resized using finished width, height, depth, and selectable units so the preview reflects the proportions you are actually designing for."
  },
  {
    question: "Can I generate a box dieline?",
    answer: "For supported structures, the Studio can generate the flat layout used for artwork placement and visualization from the template and finished dimensions. Final production geometry should still be validated before manufacturing."
  },
  {
    question: "Is the generated dieline production-ready?",
    answer: "Not universally. Use it for design, panel planning, and visualization, then validate bleed, board thickness, fold and cut tolerances, glue areas, tooling, and printer-specific requirements before manufacturing."
  },
  {
    question: "Can I upload my own packaging artwork?",
    answer: "Yes. Upload or drag artwork into the Design workspace, then crop, resize, rotate, position, replace, and organize it in layers."
  },
  {
    question: "Does artwork stay synchronized between 2D and 3D?",
    answer: "Yes. The 2D flat-layout workspace and the 3D preview use the same project state, so artwork changes can be reviewed on the assembled package without rebuilding a separate mockup."
  },
  {
    question: "Can I open and close the package in 3D?",
    answer: "Supported structures include opening and folding behavior that can be reviewed in the 3D workspace. The exact motion depends on the selected box structure."
  },
  {
    question: "Can I save and reopen my designs?",
    answer: "Yes. Account-based projects can be saved and reopened later so you can continue iterating instead of rebuilding the mockup from scratch."
  },
  {
    question: "Can I share a box preview with a client?",
    answer: "Yes. Saved projects can create shareable preview links so clients or teammates can inspect the package without receiving the editable working file."
  },
  {
    question: "What can I export from 3D Box Studio?",
    answer: "The current workflow supports exporting clean PNG previews for presentations, approvals, product planning, and other visual review needs."
  },
  {
    question: "Do I need Photoshop, Illustrator, or CAD to use it?",
    answer: "No additional software is required to use the Studio's packaging artwork and 3D preview workflow. You may still use specialist design or structural CAD tools when your production process requires them."
  },
  {
    question: "Does 3D Box Studio replace structural packaging CAD or printer proofs?",
    answer: "No. It is designed for packaging design, visualization, and review. Final manufacturing files, structural tolerances, material behavior, and press requirements should still be validated in the appropriate production workflow."
  },
  {
    question: "Do I need to install software?",
    answer: "No. 3D Box Studio runs in a modern browser. A current desktop browser with hardware-accelerated WebGL gives the best editing and 3D experience."
  },
  {
    question: "What materials and finishes can I preview?",
    answer: "The current Studio includes visual presets such as white board, kraft, soft touch, matte coated, gloss coated, and foil, plus outside and inside color controls."
  },
  {
    question: "Can I use exported mockups commercially?",
    answer: "Yes. You can use exports from your own designs in client work, presentations, marketing, and e-commerce planning as long as you have the rights to the artwork and other assets you upload."
  },
  {
    question: "Can I use the previews for Amazon or Shopify?",
    answer: "PNG previews can help with concept work, internal approvals, and listing planning. Before publishing, verify that the final image meets the current requirements of the marketplace you are using."
  }
];

export function OriginalHome() {
  return <><SiteHeader /><main id="main" className="lovable-original marketing-page">

    <section className="home-hero">
      <div className="hero-copy animate-fade-in">
        <div className="hero-badge"><Sparkles /> Free online packaging design workspace</div>
        <h1>Design <br/>the box.<br/><span>See it in 3D.</span></h1>
        <p>3D Box Studio is a free browser-based 3D box designer and packaging mockup generator. Choose a structure, set finished dimensions, design on the dieline, preview the package in 3D, and export a polished PNG—without installing software.</p>
        <div className="hero-actions"><Button asChild size="lg"><Link href="/studio">Start designing <ArrowRight /></Link></Button><Button variant="outline" size="lg" asChild><a href="#workflow"><CirclePlay /> See how it works</a></Button></div>
        <div className="hero-proof"><span>No install</span><i/><span>2D + 3D in one workflow</span><i/><span>Free to start</span></div>
      </div>
      <div className="hero-stage" role="img" aria-label="3D Box Studio concept showing a packaging workspace with artwork controls and a 3D package preview">
        <div className="hero-window">
          <div className="hero-window-bar"><div className="original-window-title"><span className="window-logo"><Box /></span><b>Noma Tea — Spring</b><span className="saved-dot">Saved</span></div><span className="window-share"><Download/> Export</span></div>
          <div className="hero-window-body">
            <div className="mini-tools">{[Box,Layers3,Sparkles,PackageCheck].map((Icon,i)=><span key={i} className={i===1?"is-active":""}><Icon/></span>)}</div>
            <div className="hero-canvas"><div className="viewport-grid"/><PackageBox open /></div>
            <div className="mini-inspector"><p>ARTWORK</p><h3>Front panel</h3><div className="mini-art"><span>NOMA</span></div><div className="mini-label"><span>Placement</span><b>Fill</b></div><div className="mini-slider"><i/></div><div className="mini-label"><span>Live preview</span><b className="quality">Synced</b></div></div>
          </div>
        </div>
        <div className="floating-note note-top"><span className="note-icon"><Ruler/></span><span><b>120 × 80 × 35 mm</b><small>Finished size</small></span></div>
        <div className="floating-note note-bottom"><span className="avatar-stack"><i>3D</i></span><span><b>Ready to export</b><small>PNG preview</small></span></div>
      </div>
    </section>

    <section className="capability-band">
      <div className="section-intro compact"><p className="eyebrow">What you can do</p><h2>One packaging workflow, from structure to shareable preview.</h2></div>
      <div className="capability-grid">{capabilities.map(([Icon,title,body])=><article key={String(title)}><span className="capability-icon"><Icon /></span><h3>{String(title)}</h3><p>{String(body)}</p></article>)}</div>
    </section>

    <section id="workflow" className="workflow-section"><div className="section-intro"><p className="eyebrow">The core workflow</p><h2>Flat artwork in. Real package out.</h2><p className="section-lede">Start with the box, design on its 2D flat layout, then use the same project to inspect the assembled result in 3D.</p></div><div className="workflow-grid">{[
      ["01","Choose the box","Pick a packaging structure, set finished dimensions and units, and adjust the material or finish."],
      ["02","Design the artwork","Work on the dieline with uploads, layers, drag-and-drop placement, crop, resize, rotation, and exact transforms."],
      ["03","Preview & download","Rotate the package, change camera views, open or close the structure, then export a PNG or share a preview."],
    ].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p><MoveUpRight/></article>)}</div></section>

    <section className="studio-proof-section">
      <div className="studio-proof-copy">
        <p className="eyebrow">Actual product, not a static mockup</p>
        <h2>Work on the dieline and the 3D package together.</h2>
        <p>The Design workspace gives you a flat packaging canvas for artwork and layers. The Preview workspace uses that same design state, so a change on the dieline can be checked immediately on the assembled package.</p>
        <ul>
          <li><CheckCircle2/> Upload or drag artwork onto the board</li>
          <li><CheckCircle2/> Select, crop, resize, rotate, and reorder layers</li>
          <li><CheckCircle2/> Map artwork to the correct package panel</li>
          <li><CheckCircle2/> Keep 2D and 3D artwork in sync</li>
        </ul>
        <Button variant="outline" asChild><Link href="/features">Explore all Studio features <ArrowRight/></Link></Button>
      </div>
      <div className="studio-live-frame">
        <div className="studio-frame-bar"><span/><span/><span/><b>Actual V2 workflow</b><Link href="/whats-new/v2">What’s new in V2 <ArrowRight/></Link></div>
        <video className="studio-proof-video" autoPlay muted loop playsInline preload="metadata" poster="/images/v2-launch/flatten-assemble-poster.webp" aria-label="3DBoxStudio V2 box flatten and assemble animation">
          <source src="/animations/flatten-assemble-2.mp4" type="video/mp4"/>
        </video>
        <p className="studio-frame-caption">Current V2 Studio footage showing the same package moving between flat and assembled views.</p>
      </div>
    </section>

    <section className="feature-story feature-story-dimensions">
      <div className="feature-story-copy"><p className="eyebrow">Dimensions + structure</p><h2>Design around the package you actually need.</h2><p>Change finished dimensions directly in the Studio, switch units, and work with packaging structures instead of stretching a flat image template. Opening and folding controls help you understand how the package behaves as well as how it looks.</p><div className="feature-points"><span><Ruler/>Finished dimensions</span><span><PanelsTopLeft/>Structure templates</span><span><FoldVertical/>Fold/open preview</span></div><Link className="text-link-arrow" href="/box-templates">Browse box structures <ArrowRight/></Link></div>
      <div className="dimension-card"><span className="dimension-kicker">Finished size</span><strong>120 × 80 × 35 <small>mm</small></strong><div className="dimension-rulers"><i/><i/><i/></div><div className="dimension-foot"><span>Width</span><span>Height</span><span>Depth</span></div></div>
    </section>

    <section className="feature-story reverse">
      <div className="feature-story-copy"><p className="eyebrow">Artwork without mockup gymnastics</p><h2>Edit the design itself, not a fake perspective layer.</h2><p>Place artwork on the flat package, use normal visual editing controls, and let the 3D view do the perspective work. That makes iteration much faster when a logo, panel graphic, or crop needs to change.</p><div className="feature-points"><span><MousePointer2/>Drag & transform</span><span><Layers3/>Layers</span><span><ImagePlus/>Artwork uploads</span></div><Link className="text-link-arrow" href="/packaging-design-online">See the design workflow <ArrowRight/></Link></div>
      <div className="artwork-demo-card"><div className="dieline-mini"><div className="dieline-panel p1"/><div className="dieline-panel p2"><span>NOMA</span></div><div className="dieline-panel p3"/><div className="dieline-panel p4"/></div><div className="artwork-toolbar"><span><MousePointer2/> Select</span><span><Layers3/> Layers</span><span><ImagePlus/> Replace</span></div></div>
    </section>

    <section className="feature-story feature-story-preview">
      <div className="feature-story-copy"><p className="eyebrow">Review from every angle</p><h2>Use 3D for decisions—not decoration.</h2><p>Rotate and zoom the package, jump between camera angles, review materials and finishes, and scrub through opening or closing behavior. When the proof is ready, download a clean PNG for the next conversation.</p><div className="feature-points"><span><Camera/>Camera views</span><span><Rotate3D/>Orbit + zoom</span><span><Download/>PNG export</span></div><Link className="text-link-arrow" href="/3d-box-mockup-generator">3D box mockup generator <ArrowRight/></Link></div>
      <div className="preview-demo-card"><PackageBox open/><div className="preview-controls"><span>Front</span><span>¾</span><span>Top</span><b>Open 68%</b></div></div>
    </section>

    <section className="save-share-section">
      <div><p className="eyebrow">Save, share, come back</p><h2>Your package does not disappear when the tab closes.</h2><p>Create an account to keep projects organized, reopen designs later, and share a browser preview with a client or teammate.</p></div>
      <div className="save-share-grid">
        <article><Save/><h3>Save projects</h3><p>Keep work attached to your account and continue where you left off.</p></article>
        <article><Share2/><h3>Share previews</h3><p>Send a link so someone can inspect the package without editing your file.</p></article>
        <article><Layers3/><h3>Reopen designs</h3><p>Return to previous packaging work instead of rebuilding a mockup from scratch.</p></article>
      </div>
    </section>

    <section id="showcase" className="showcase-section"><div className="showcase-image"><Image src="/images/lovable-original-still-life.jpg" alt="A white carton, charcoal mailer, and kraft paper box representing different packaging structures and finishes" width={1600} height={1000} sizes="(max-width: 700px) 100vw, 600px"/><span className="image-caption">Structure, artwork, material, and presentation in one visual workflow.</span></div><div className="showcase-copy"><p className="eyebrow">Templates, not one-size-fits-all mockups</p><h2>Start from a real packaging structure.</h2><p>3D Box Studio is being built around reusable structure templates such as folding cartons, tuck-style boxes, lids, and mailer-style packaging. Each template owns its geometry, dieline behavior, and opening logic so new structures can be added without hard-coding the whole Studio around one box.</p><ul><li><span>01</span>Choose a structure</li><li><span>02</span>Set its finished size</li><li><span>03</span>Design and preview the result</li></ul><Button variant="outline" asChild><Link href="/box-templates">Explore box templates <ArrowRight/></Link></Button></div></section>

    <section className="dieline-section">
      <div className="dieline-copy"><p className="eyebrow">Dieline generation</p><h2>Generate a design-ready flat layout from your box setup.</h2><p>For supported structures, 3D Box Studio can use box dimensions and template geometry to create the flat layout you design on. That is useful for artwork planning, panel placement, and structure visualization.</p><div className="accuracy-note"><Scissors/><div><b>Production note</b><span>Dimensional and production tolerances are still being improved. Before manufacturing, validate final dielines, bleed, tolerances, material behavior, and knife/fold requirements with your printer or structural packaging workflow.</span></div></div><Button variant="outline" asChild><Link href="/box-dieline-generator">Learn about the dieline generator <ArrowRight/></Link></Button></div>
      <div className="dieline-visual"><div className="dieline-sheet"><i className="dl-a"/><i className="dl-b"/><i className="dl-c"/><i className="dl-d"/><i className="dl-e"/><span>flat layout</span></div><ArrowRight/><div className="dieline-box"><PackageBox/></div></div>
    </section>

    <section className="use-cases-section"><div><p className="eyebrow">Built for real packaging conversations</p><h2>Useful before the sample, the press proof, and the photo shoot.</h2></div><div className="use-case-grid">{useCases.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></section>

    <section className="answer-section">
      <div className="answer-intro sticky">
        <p className="eyebrow">Frequently asked questions</p>
        <h2>Answers before you open the Studio.</h2>
        <p><strong>3D Box Studio is a free online 3D box designer and packaging mockup generator.</strong> It combines supported box structures, dimensions, a 2D flat-layout artwork workspace, and interactive 3D review in the browser.</p>
        <div className="seo-home-links"><Link href="/features">Features <ArrowRight/></Link><Link href="/faq">Full FAQ <ArrowRight/></Link><Link href="/blog">Packaging guides <ArrowRight/></Link></div>
      </div>
      <div className="answer-accordion">
        {HOME_FAQS.map((item,index)=><details key={item.question} open={index===0}>
          <summary><span>{item.question}</span><i aria-hidden="true">+</i></summary>
          <p>{item.answer}</p>
        </details>)}
      </div>
    </section>

    <section id="details" className="closing-section"><p className="eyebrow">Your next package starts here</p><h2>Make the flat design feel real.</h2><p>Choose a box, set the size, place the artwork, and inspect it in 3D.</p><Button asChild size="lg"><Link href="/studio">Open 3D Box Studio <ArrowRight/></Link></Button></section>
    <footer><BrandMark/><nav aria-label="Footer navigation"><Link href="/features">Features</Link><Link href="/box-templates">Templates</Link><Link href="/blog">Guides</Link><Link href="/faq">FAQ</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav><span>© 2026 3D Box Studio</span></footer>
  </main></>
}
