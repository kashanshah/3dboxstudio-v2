import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BoxSizeCalculator, type CalculatorTarget } from '@/components/box-size-calculator';
import { FaqSection } from '@/components/faq-section';
import { LandingPage } from '@/components/seo/landing-page';
import { MoreTools } from '@/components/seo/more-tools';
import { BOX_TEMPLATE_PAGES } from '@/content/box-template-pages';
import { SEO_PAGES, seoPageMetadata, servedSeoPage } from '@/content/seo-pages';
import { styleForTemplate } from '@/lib/dieline/styles';
import { softwareApplicationSchema } from '@/lib/seo';

const page = SEO_PAGES.calculator;
export const metadata: Metadata = seoPageMetadata(page);

const faqs = [
  { question: 'How much bigger than the product should a box be?', answer: 'For a retail carton, about 2–5 mm more than the product on every side, so it slides in and out without rattling. For shipping with bubble wrap or crinkle paper, about 20 mm on every side. The calculator adds the room you choose to all three sizes.' },
  { question: 'What is the difference between inside and outside dimensions?', answer: 'Inside dimensions are the space the product sits in; outside dimensions include the board on every side. Order a box by its inside size so the product fits, and use the outside size for shipping rates and shelf space. The outside is roughly the inside plus two board thicknesses on each side.' },
  { question: 'Which size comes first: length, width or height?', answer: 'Length × width × height, where length and width are the opening (length the longer side) and height runs from the opening to the bottom. The calculator puts the longer of your first two sizes first.' },
  { question: 'Which board should I use?', answer: 'A rule of thumb: 18 pt (about 0.46 mm) card for light retail cartons, 24 pt (about 0.61 mm) for heavier ones, E-flute corrugated for mailers and light shipping, B-flute for heavier shipping, and 2 mm greyboard for rigid gift boxes. Your printer will confirm the grade they stock.' },
  { question: 'Is the outside size exact?', answer: 'No, it is an estimate: each box style folds its board a little differently. Open the style in the generator and choose Outside to type an exact outside size, or read it from the flat sheet.' },
];

export default function BoxSizeCalculatorPage() {
  if (!servedSeoPage(page)) notFound();
  const targets: CalculatorTarget[] = BOX_TEMPLATE_PAGES.flatMap(item => {
    const style = styleForTemplate(item.templateId);
    return style ? [{ slug: item.slug, name: item.name, styleId: style.id }] : [];
  });
  return <LandingPage
    crumbs={[{ name: 'Box dieline generator', path: '/box-dieline-generator' }, { name: 'Box size calculator', path: page.path }]}
    eyebrow="Free tool"
    title="Box size calculator"
    intro="Enter your product's size and how much room it needs, and get the inside and outside dimensions of its box, a board to start from and the box styles that suit it. Then make the dieline in that size, free."
    updated="2026-10-20"
    schema={[
      softwareApplicationSchema({ name: 'Box size calculator', path: page.path, description: page.description, features: ['Inside and outside box dimensions from product size', 'Padding for snug, standard or cushioned fit', 'Board suggestion by weight and use', 'Box style suggestions with dielines in that size'] }),
      { '@type': 'FAQPage', mainEntity: faqs.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
    ]}>
    <BoxSizeCalculator targets={targets} />

    <div className="btp-sections">
      <section>
        <h2>How the box size is worked out</h2>
        <p>The inside of the box is the product plus the room you choose on every side: the length, the width and the height each grow by twice the padding. The outside adds the board itself, about one thickness on every side. Those are the sizes a printer quotes as inside (I.D.) and outside (O.D.) dimensions.</p>
      </section>
      <section>
        <h2>How much room to leave</h2>
        <table className="btp-table"><thead><tr><th scope="col">Fit</th><th scope="col">Each side</th><th scope="col">Use it for</th></tr></thead>
          <tbody>
            <tr><th scope="row">Snug</th><td>2 mm (1/16 in)</td><td>Retail cartons for rigid products: bottles, jars, devices</td></tr>
            <tr><th scope="row">Standard</th><td>5 mm (3/16 in)</td><td>Tissue wraps, gift boxes, products that are lifted out</td></tr>
            <tr><th scope="row">Cushioned</th><td>20 mm (3/4 in)</td><td>Shipping with bubble wrap, crinkle paper or a foam insert</td></tr>
          </tbody></table>
      </section>
      <section>
        <h2>Which board to start from</h2>
        <table className="btp-table"><thead><tr><th scope="col">Product</th><th scope="col">Board</th><th scope="col">Thickness</th></tr></thead>
          <tbody>
            <tr><th scope="row">Light retail, under 0.5 kg</th><td>18 pt SBS card</td><td>0.46 mm</td></tr>
            <tr><th scope="row">Retail, 0.5–2 kg</th><td>24 pt SBS card</td><td>0.61 mm</td></tr>
            <tr><th scope="row">Mailers and light shipping</th><td>E-flute corrugated</td><td>about 1.5 mm</td></tr>
            <tr><th scope="row">Heavy shipping, over 2 kg</th><td>B-flute corrugated</td><td>about 3 mm</td></tr>
            <tr><th scope="row">Rigid gift boxes</th><td>Greyboard, wrapped</td><td>2 mm</td></tr>
          </tbody></table>
      </section>
      <section>
        <h2>From size to dieline</h2>
        <p>Each suggested style opens its <Link href="/box-dieline-generator">dieline generator</Link> with the inside size and board filled in. There you can switch to the outside or crease-to-crease size, adjust flaps, and download the dieline as SVG, PDF, DXF, PNG or a Cricut file with no account. For how the three kinds of size relate, read <Link href="/blog/how-to-measure-a-box-inside-vs-outside-dimensions">inside vs outside box dimensions</Link>.</p>
      </section>
    </div>

    <FaqSection items={faqs} title="Box size questions" links={[{ href: '/box-dieline-generator', label: 'Box dieline generator' }, { href: '/box-templates', label: 'Box templates' }]} />
    <MoreTools exclude="/box-size-calculator" />
  </LandingPage>;
}
