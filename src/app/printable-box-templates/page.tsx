import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DielineGenerator } from '@/components/dieline-generator/dieline-generator';
import { FaqSection } from '@/components/faq-section';
import { LandingPage } from '@/components/seo/landing-page';
import { MoreTools } from '@/components/seo/more-tools';
import { getBoxTemplatePage } from '@/content/box-template-pages';
import { SEO_PAGES, seoPageMetadata, servedSeoPage } from '@/content/seo-pages';
import { generatorSetup } from '@/lib/dieline/thumbnails';
import { softwareApplicationSchema } from '@/lib/seo';

const page = SEO_PAGES.printable;
export const metadata: Metadata = seoPageMetadata(page);

// Box styles that fold well from card on a home printer, with a size people often make them in.
const CRAFT_STYLES = [
  { slug: 'pillow-box', size: '6 × 3.5 × 1.5 in', use: 'Favours, gift cards, jewellery' },
  { slug: 'reverse-tuck-end-box', size: '3 × 3 × 4 in', use: 'Candles, soap, small products' },
  { slug: 'gable-box', size: '4 × 2.5 × 3.5 in', use: 'Party favours and treats, with a handle' },
  { slug: 'drawer-box', size: '3 × 1 × 3 in', use: 'Rings, earrings, small keepsakes' },
  { slug: 'telescope-box', size: '4 × 2 × 4 in', use: 'Gift boxes with a lift-off lid' },
  { slug: 'tray-box', size: '6 × 1.5 × 4 in', use: 'Trays and inserts' },
  { slug: 'cake-box', size: '4 × 3 × 4 in', use: 'Cupcakes and cookies' },
];

const faqs = [
  { question: 'How do I print a box template at the right size?', answer: 'Download the tiled PDF for A4 or Letter and print it at 100% or "actual size", with "fit to page" turned off. Every page has a 50 mm scale bar: measure it with a ruler before you cut. If it is not 50 mm, the printer scaled the page.' },
  { question: 'What paper should I print a box template on?', answer: 'Cardstock rather than paper: about 65–110 lb cover (176–300 gsm) folds into a box that holds its shape. Check your printer\'s maximum paper weight first; many home printers take up to about 250–300 gsm through the rear or manual feed.' },
  { question: 'What do the different lines mean?', answer: 'Solid red lines are cuts, dashed blue lines are folds (score them before folding), the green dashed line is the bleed for printed backgrounds, and the purple line is the safe zone that text should stay inside. Light orange areas take glue.' },
  { question: 'My box is too big for one sheet. What now?', answer: 'The tiled PDF splits it across pages with a 10 mm overlap and crosshair marks: trim the margin off one page, line its marks up with the next and tape them together, then cut out the box. For a single sheet, choose a smaller size or print it larger at a print shop from the one-page PDF.' },
  { question: 'Is it free?', answer: 'Yes. Every template downloads free as PDF, SVG, DXF, PNG or a Cricut file, without an account, a watermark or a limit.' },
];

export default function PrintableBoxTemplatesPage() {
  if (!servedSeoPage(page)) notFound();
  const styles = CRAFT_STYLES.flatMap(item => {
    const template = getBoxTemplatePage(item.slug);
    return template ? [{ ...item, name: template.name }] : [];
  });
  return <LandingPage
    crumbs={[{ name: 'Box templates', path: '/box-templates' }, { name: 'Printable box templates', path: page.path }]}
    eyebrow="Box templates with measurements"
    title="Printable box templates in any size"
    intro="Pick a box, type the measurements you need, and print the template at 100% on A4 or Letter: cut on the red lines, score the dashed ones and fold. Free, with no sign-up."
    updated="2026-10-20"
    schema={[
      softwareApplicationSchema({ name: 'Printable box template maker', path: page.path, description: page.description, features: ['Any size in mm or inches', 'Tiled PDF for A4 and Letter with alignment marks', '50 mm scale bar to check the print', '16 box styles', 'No sign-up'] }),
      { '@type': 'FAQPage', mainEntity: faqs.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
    ]}>
    <DielineGenerator setup={generatorSetup('pillow-box', { length: 6, width: 3.5, depth: 1.5, units: 'in' })} title="Make your printable template" defaultExport="pdf_letter"
      page={{ type: 'dieline_generator', slug: 'printable-box-templates' }} />

    <div className="btp-sections">
      <section>
        <h2>How to print and make a box</h2>
        <ol>
          <li>Choose a style above and type your measurements: inside sizes, in inches or millimetres.</li>
          <li>Under Export, choose PDF tiled on Letter or A4 and download it.</li>
          <li>Print at 100% (actual size) on cardstock. Measure the 50 mm scale bar to check.</li>
          <li>Tape the pages together by the crosshair marks if the box spans more than one.</li>
          <li>Score the dashed blue lines with a bone folder or an empty ballpoint pen against a ruler.</li>
          <li>Cut on the solid red lines, fold on the scores, and glue the light orange flaps.</li>
        </ol>
      </section>
      <section>
        <h2>Measurements: inside, outside or flat</h2>
        <p>The sizes you type are the inside of the box by default: the space your item sits in. Choose Outside to size the finished box from its outside, or Manufacture for the crease-to-crease sizes on the flat sheet. Thicker cardstock makes the outside a little bigger for the same inside, and the template allows for it when you set the thickness. More in <Link href="/blog/how-to-measure-a-box-inside-vs-outside-dimensions">inside vs outside box dimensions</Link>.</p>
      </section>
      <section>
        <h2>Box styles that print well at home</h2>
        <table className="btp-table"><thead><tr><th scope="col">Style</th><th scope="col">A size to start from</th><th scope="col">Good for</th></tr></thead>
          <tbody>{styles.map(item => <tr key={item.slug}><th scope="row"><Link href={`/box-templates/${item.slug}`}>{item.name}</Link></th><td>{item.size}</td><td>{item.use}</td></tr>)}</tbody></table>
      </section>
      <section>
        <h2>Paper and card</h2>
        {/* VERIFY: cardstock weights and home-printer limits vary by brand and model. */}
        <p>Cardstock of about 65–110 lb cover (176–300 gsm, roughly 0.25–0.4 mm) folds cleanly and stands up. Lighter paper works for a quick test, not a finished box. Feed thick card through the printer&apos;s rear or manual tray, one sheet at a time, and set the generator&apos;s board thickness to match so the panels allow for it. Cutting it on a machine instead? See <Link href="/cricut-box-templates">Cricut box templates</Link>.</p>
      </section>
    </div>

    <FaqSection items={faqs} title="Printable template questions" links={[{ href: '/box-dieline-generator', label: 'Box dieline generator' }, { href: '/box-templates', label: 'All box templates' }]} />
    <MoreTools exclude="/printable-box-templates" />
  </LandingPage>;
}
