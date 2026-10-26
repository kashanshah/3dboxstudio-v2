import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DielineGenerator } from '@/components/dieline-generator/dieline-generator';
import { FaqSection } from '@/components/faq-section';
import { LandingPage } from '@/components/seo/landing-page';
import { MoreTools } from '@/components/seo/more-tools';
import { SEO_PAGES, seoPageMetadata, servedSeoPage } from '@/content/seo-pages';
import { CRICUT_STEPS } from '@/lib/dieline/export/cricut';
import { generatorSetup } from '@/lib/dieline/thumbnails';
import { softwareApplicationSchema } from '@/lib/seo';

const page = SEO_PAGES.cricut;
export const metadata: Metadata = seoPageMetadata(page);

const faqs = [
  { question: 'How do I make a box template for Cricut in my size?', answer: 'Choose a box style above, type your measurements, keep Cricut / Silhouette SVG selected under Export and download it. Upload the SVG to Design Space, set the blue lines to Score, attach, and cut on cardstock.' },
  { question: 'Why does the template import at the wrong size?', answer: 'Design Space reads an SVG without units at 72 pixels per inch. These files carry their size in inches, so they import at the size you made them. If yours still looks off, unlock the proportions and type the width shown in the generator.' },
  { question: 'How do I get the fold lines to score instead of cut?', answer: 'In Design Space, ungroup the design, select the blue score lines and change their operation from Basic Cut to Score (with a scoring stylus or scoring wheel), then select everything and Attach so the scores stay in place on the mat.' },
  { question: 'Does it work with Silhouette?', answer: 'Yes. Silhouette Studio Designer Edition and above open the SVG; Basic Edition does not import SVG, so download the DXF instead, which Basic opens. Set the score lines to a perforation or a light cut pass.' },
  { question: 'What is the biggest box I can cut?', answer: 'On a 12 × 24 in mat the cut area is about 11.5 × 23.5 in (292 × 597 mm) flat. The generator tells you whether your box fits; if not, make it smaller, print and hand-cut the tiled PDF, or use a cutting table with the DXF.' },
];

export default function CricutBoxTemplatesPage() {
  if (!servedSeoPage(page)) notFound();
  return <LandingPage
    crumbs={[{ name: 'Box templates', path: '/box-templates' }, { name: 'Cricut box templates', path: page.path }]}
    eyebrow="Cricut and Silhouette"
    title="Cricut box templates in your exact size"
    intro="Make a box SVG for Cricut Design Space or Silhouette in the size you need: cut lines in black, score lines in blue, sized in inches so it imports at the right size. 16 box styles, free, no account."
    updated="2026-10-20"
    schema={[
      softwareApplicationSchema({ name: 'Cricut box template maker', path: page.path, description: page.description, features: ['Cut and score SVG sized in inches', 'DXF for Silhouette Studio Basic', 'Any size in inches or mm', 'Mat-size check', '16 box styles', 'No sign-up'] }),
      { '@type': 'FAQPage', mainEntity: faqs.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
    ]}>
    <DielineGenerator setup={generatorSetup('gable-box', { length: 4, width: 2.5, depth: 3.5, units: 'in' })} title="Make your Cricut box" defaultExport="cricut"
      page={{ type: 'dieline_generator', slug: 'cricut-box-templates' }} />

    <div className="btp-sections">
      <section>
        <h2>Cutting it in Design Space</h2>
        <ol>{CRICUT_STEPS.map(step => <li key={step}>{step}</li>)}</ol>
      </section>
      <section>
        <h2>Which machine and mat</h2>
        {/* VERIFY: cut-area figures per machine and mat; check against Cricut's current specifications. */}
        <table className="btp-table"><thead><tr><th scope="col">Mat</th><th scope="col">Largest flat box</th><th scope="col">Machines</th></tr></thead>
          <tbody>
            <tr><th scope="row">12 × 12 in</th><td>about 11.5 × 11.5 in</td><td>Maker, Explore, Venture</td></tr>
            <tr><th scope="row">12 × 24 in</th><td>about 11.5 × 23.5 in</td><td>Maker, Explore, Venture</td></tr>
            <tr><th scope="row">Joy Xtra card mat</th><td>about 8.5 × 11 in</td><td>Joy Xtra</td></tr>
          </tbody></table>
        <p>The flat sheet size is shown in the generator. Score lines need a scoring stylus (Explore) or scoring wheel (Maker); without one, cut the dieline as it is and score by hand along the blue lines.</p>
      </section>
      <section>
        <h2>Cardstock</h2>
        {/* VERIFY: recommended cardstock weights for Cricut box projects. */}
        <p>Use 65–110 lb cardstock (176–300 gsm). Light card cuts and scores cleanly; heavier card makes a sturdier box but needs a deeper score so it folds without cracking. Set the generator&apos;s board thickness to your card&apos;s, about 0.25–0.4 mm, so the panels allow for it.</p>
      </section>
      <section>
        <h2>No cutting machine?</h2>
        <p>Download the tiled PDF instead and print it at 100% on A4 or Letter, then cut by hand: see <Link href="/printable-box-templates">printable box templates</Link>. For laser cutters and cutting tables, the DXF keeps cut and crease lines on separate layers. More on file types in <Link href="/blog/box-template-svg-cricut-laser-cutter">box templates for Cricut and laser cutters</Link>.</p>
      </section>
    </div>

    <FaqSection items={faqs} title="Cricut box questions" links={[{ href: '/box-dieline-generator', label: 'Box dieline generator' }, { href: '/box-templates', label: 'All box templates' }]} />
    <MoreTools exclude="/cricut-box-templates" />
  </LandingPage>;
}
