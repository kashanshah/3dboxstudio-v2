import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Box, CheckCircle2, Layers3, LayoutGrid, Share2, Sparkles } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { site } from '@/lib/site';
import styles from './page.module.css';
import { ZoomGallery, ZoomImage } from './zoom-image';

const title='What’s New in 3DBoxStudio V2';
const description='Explore the new 3DBoxStudio V2 workflow: box setup, dieline artwork, live 3D review, Projects with multiple Box Designs, sharing, exports, and what is coming next.';

export const metadata:Metadata={
  title,
  description,
  alternates:{canonical:'/whats-new/v2'},
  openGraph:{title,description,type:'website',url:'/whats-new/v2'},
  twitter:{card:'summary_large_image',title,description}
};

const faqs=[
  ['What changed in 3DBoxStudio V2?','V2 organizes the Studio around a clearer Box → Design → Preview & Download workflow. Box setup, dimensions, materials, dieline artwork, 3D review, sharing, and exports now sit in one more coherent packaging workflow.'],
  ['Does my existing 3DBoxStudio account still work?','Yes. Existing users can sign in with their current account and continue using the V2 Studio.'],
  ['What is a Project compared with a Box Design?','A Project is the workspace for a packaging job. A Box Design is an individual package design inside that Project. Projects let related packaging work stay together instead of becoming disconnected files.'],
  ['Can I save multiple boxes in one Project?','Yes. A Project can contain multiple Box Designs, which is useful for product variants, sizes, related SKUs, or alternative packaging directions.'],
  ['Can I share and export designs?','Yes. Saved designs can be shared through view-only preview links, and the current Studio supports PNG export. The Design workspace also exposes print / PDF output for the flat layout.'],
  ['Are more box templates and dielines coming?','Yes. The built-in library will expand with many more ready-to-use packaging structures and dielines supplied by 3DBoxStudio. This is separate from importing your own dieline.'],
  ['Are Scenes available now?','Not yet. Scenes are coming soon. The intended workflow is to take multiple saved Box Designs from a Project and compose them together in a Scene for staged product-shot and presentation workflows.']
] as const;

const workflow=[
  {number:'01',eyebrow:'Box',title:'Set the structure, size, and finish.',body:'Choose a supported package, enter finished dimensions, control board thickness, then preview materials and finishes before you touch the artwork.',image:'/images/v2-launch/studio-box-size.png',alt:'3DBoxStudio V2 Box & Size workspace with dimensions and live 3D box preview'},
  {number:'02',eyebrow:'Design',title:'Work on the dieline and see the package update.',body:'Add artwork to the flat layout, organize it in layers, and keep a live 3D preview beside the design canvas so panel placement is easier to judge.',image:'/images/v2-launch/studio-design-artwork.png',alt:'3DBoxStudio V2 dieline artwork workspace with multiple artwork layers and live 3D preview'},
  {number:'03',eyebrow:'Preview & Download',title:'Review the assembled box, then move the work forward.',body:'Orbit the package, inspect the assembled result, scrub through the open / close state, export a PNG, or copy a view-only share link.',image:'/images/v2-launch/studio-preview-3d.png',alt:'3DBoxStudio V2 Preview & Download workspace showing a branded package in 3D'}
] as const;

export default function V2WhatsNewPage(){
  const origin=site.url.toString().replace(/\/$/,'');
  const schema={'@context':'https://schema.org','@graph':[
    {'@type':'WebPage',name:title,description,url:origin+'/whats-new/v2',isPartOf:{'@type':'WebSite',name:'3DBoxStudio',url:origin+'/'},about:{'@type':'SoftwareApplication',name:'3DBoxStudio',applicationCategory:'DesignApplication'}},
    {'@type':'FAQPage',mainEntity:faqs.map(([question,answer])=>({'@type':'Question',name:question,acceptedAnswer:{'@type':'Answer',text:answer}}))}
  ]};

  return <><SiteHeader/><main id="main" className={styles.page}><ZoomGallery>
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <span className={styles.kicker}><Sparkles size={15}/> 3DBoxStudio V2</span>
        <h1>A new Studio for turning flat packaging into <em>real 3D.</em></h1>
        <p>V2 connects structure, size, materials, dieline artwork, 3D review, Projects, sharing, and exports in one clearer packaging workflow.</p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryCta} href="/studio?ref=v2-whats-new&cta=hero">Open the new Studio <ArrowRight size={18}/></Link>
          <a className={styles.secondaryCta} href="#workflow">Explore what changed</a>
        </div>
        <div className={styles.heroProof}>
          <span><CheckCircle2/> Existing accounts work</span>
          <span><CheckCircle2/> Multiple Box Designs per Project</span>
          <span><CheckCircle2/> Share + export</span>
        </div>
      </div>
      <div className={styles.heroMedia}>
        <div className={styles.mediaBar}><span/><span/><span/><b>Flat → assembled</b></div>
        <video autoPlay muted loop playsInline preload="metadata" poster="/images/v2-launch/flatten-assemble-poster.png" aria-label="3DBoxStudio V2 box flatten and assemble animation">
          <source src="/animations/flatten-assemble-2.mp4" type="video/mp4"/>
        </video>
      </div>
    </section>

    <section className={styles.summary}>
      <span className={styles.eyebrow}>Why V2</span>
      <h2>One workflow from box setup to client-ready review.</h2>
      <p>The biggest change is not one isolated feature. It is how the pieces now fit together: define the box, design on its flat layout, inspect the same work in 3D, save related designs inside a Project, and share or export the result.</p>
    </section>

    <section id="workflow" className={styles.workflow}>
      {workflow.map((step)=><article className={styles.workflowStep} key={step.number}>
        <div className={styles.stepCopy}>
          <span className={styles.stepNumber}>{step.number}</span>
          <p className={styles.stepEyebrow}>{step.eyebrow}</p>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </div>
        <figure><ZoomImage src={step.image} alt={step.alt} width={2048} height={1150} sizes="(max-width: 760px) 980px, (max-width: 1100px) 58vw, 920px"/></figure>
      </article>)}
    </section>

    <section className={styles.detailGrid}>
      <article>
        <div className={styles.detailCopy}>
          <span className={styles.eyebrow}>Material & finish</span>
          <h2>Preview more than geometry.</h2>
          <p>Switch between White board, Kraft, Soft touch, Matte coated, Gloss coated, and Foil, then control inside and outside color independently.</p>
        </div>
        <div className={styles.portraitMedia}><ZoomImage src="/images/v2-launch/studio-material-finish.png" alt="Material and Finish panel in 3DBoxStudio V2" width={1016} height={2016} sizes="(max-width: 820px) 90vw, 38vw"/></div>
      </article>
      <article>
        <div className={styles.detailCopy}>
          <span className={styles.eyebrow}>Download & share</span>
          <h2>Move the review forward.</h2>
          <p>Download the current 3D camera view as a PNG, create a view-only interactive share link, or use the flat-layout print / PDF workflow from the Design workspace.</p>
        </div>
        <div className={styles.portraitMedia}><ZoomImage src="/images/v2-launch/studio-download.png" alt="Download and Share panel in 3DBoxStudio V2" width={1066} height={2022} sizes="(max-width: 820px) 90vw, 38vw"/></div>
      </article>
    </section>

    <section className={styles.projects}>
      <div className={styles.projectsCopy}>
        <span className={styles.eyebrow}>Projects</span>
        <h2>A packaging job can be bigger than one box.</h2>
        <p>A Project is the container for related work. Inside it, you can keep multiple Box Designs together—for example several sizes, product variants, SKUs, or alternative packaging directions.</p>
        <div className={styles.projectMap}>
          <span className={styles.projectRoot}><Box/> Project</span>
          <ArrowRight/>
          <div><span>Box Design A</span><span>Box Design B</span><span>Box Design C</span></div>
        </div>
      </div>
      <figure className={styles.projectsMedia}><ZoomImage src="/images/v2-launch/studio-design-empty.png" alt="Clean 3DBoxStudio V2 dieline design workspace" width={2048} height={1149} sizes="(max-width: 760px) 920px, (max-width: 1100px) 100vw, 720px"/></figure>
    </section>

    <section className={styles.roadmap}>
      <div className={styles.roadmapIntro}>
        <span className={styles.eyebrow}>Built for what comes next</span>
        <h2>V2 is a foundation, not a finish line.</h2>
        <p>The template-driven architecture gives 3DBoxStudio room to grow without turning every new packaging structure into a one-off implementation.</p>
      </div>
      <div className={styles.roadmapGrid}>
        <article>
          <span className={styles.comingSoon}>Coming soon</span>
          <LayoutGrid/>
          <h3>Many more templates & dielines</h3>
          <p>We are expanding the built-in library with many more packaging structures and ready-to-use dielines supplied by 3DBoxStudio.</p>
        </article>
        <article>
          <span className={styles.comingSoon}>Coming soon</span>
          <Share2/>
          <h3>Scenes with multiple Box Designs</h3>
          <p>The planned Scene workflow will let you take multiple saved Box Designs from a Project and compose them together for staged product shots and presentations.</p>
        </article>
      </div>
    </section>

    <section className={styles.fullMedia}>
      <div className={styles.fullMediaCopy}>
        <span className={styles.eyebrow}>2D ↔ 3D</span>
        <h2>Design flat. Review in 3D. Keep moving.</h2>
        <p>Artwork placement stays connected to the package you are reviewing instead of becoming a separate perspective mockup to rebuild after every change.</p>
      </div>
      <figure><ZoomImage src="/images/v2-launch/studio-design-artwork.png" alt="Populated package dieline with artwork and synchronized live 3D preview" width={2048} height={1144} sizes="(max-width: 760px) 980px, (max-width: 1100px) 100vw, 860px"/></figure>
    </section>

    <section id="faq" className={styles.faq}>
      <div className={styles.faqIntro}><span className={styles.eyebrow}>FAQ</span><h2>What existing users should know.</h2></div>
      <div className={styles.faqList}>{faqs.map(([question,answer],index)=><details key={question} open={index===0}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
    </section>

    <section className={styles.closing}>
      <span className={styles.eyebrow}>V2 is live</span>
      <h2>Open your next box in the new Studio.</h2>
      <p>Choose a structure, set the size, place the artwork, and inspect the result in 3D.</p>
      <Link className={styles.primaryCta} href="/studio?ref=v2-whats-new&cta=closing">Open 3DBoxStudio <ArrowRight size={18}/></Link>
    </section>
  </ZoomGallery></main><SiteFooter/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/></>;
}
