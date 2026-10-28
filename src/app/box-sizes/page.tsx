import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BoxSizeFinder } from '@/components/box-size-finder';
import { FaqSection } from '@/components/faq-section';
import { LandingPage } from '@/components/seo/landing-page';
import { MoreTools } from '@/components/seo/more-tools';
import { BOX_TEMPLATE_PAGES } from '@/content/box-template-pages';
import { SEO_PAGES, seoPageMetadata, servedSeoPage } from '@/content/seo-pages';
import { BOX_SIZE_GROUPS, CORRUGATED_WALL_MM, bothUnits, chartBoxHref, volume } from '@/lib/standard-box-sizes';
import { softwareApplicationSchema } from '@/lib/seo';
import { inactiveTemplateIds } from '@/lib/packaging/template-catalog';
import { getTemplateCatalog } from '@/server/templates';

const page = SEO_PAGES.sizes;
export const metadata: Metadata = seoPageMetadata(page);

const faqs = [
  { question: 'Is there an official standard box size?', answer: 'No single standard covers all boxes. Suppliers stock sizes they sell in volume, carriers publish their own box programs, and retail cartons are sized to the product. The sizes on this page are the common ones; confirm the exact inside size with your supplier.' },
  { question: 'What are small, medium and large box dimensions?', answer: 'Typical stock moving and shipping boxes: small about 16 × 12 × 12 in (40.6 × 30.5 × 30.5 cm), medium about 18 × 18 × 16 in (45.7 × 45.7 × 40.6 cm), large about 18 × 18 × 24 in (45.7 × 45.7 × 61 cm). Each supplier\'s sizes differ slightly.' },
  { question: 'What are medium box dimensions in cm?', answer: 'A medium moving box is about 46 × 46 × 41 cm (18 × 18 × 16 in). In metric ranges, a 400 × 300 × 300 mm carton is a common medium size: eight fit on each layer of a Euro pallet.' },
  { question: 'Which order are box dimensions written in?', answer: 'Length × width × height (or depth). Length and width are the opening, length the longer side; height runs from the opening to the bottom. A 12 × 9 × 4 in mailer opens on a 12 × 9 in face and is 4 in deep.' },
  { question: 'Are box sizes inside or outside dimensions?', answer: 'Stock boxes are usually quoted by their inside size, the space for the product. Pallet-sized metric cartons are often quoted by their outside size. On single-wall corrugated the outside is about 3 to 5 mm larger on each side.' },
  { question: 'Should I use a standard size or a custom size?', answer: 'A standard box is cheaper and quicker for small runs. A custom size cuts empty space, filler and dimensional-weight shipping, and looks better. The finder above gives both: the standard boxes your product fits, and the size made to measure.' },
];

export default async function BoxSizesPage() {
  if (!servedSeoPage(page)) notFound();
  const hidden = inactiveTemplateIds(await getTemplateCatalog());
  const slugs = BOX_TEMPLATE_PAGES.filter(item => !hidden.has(item.templateId)).map(item => item.slug);
  return <LandingPage
    crumbs={[{ name: 'Box sizes', path: page.path }]}
    eyebrow="Free tool"
    title="Standard box sizes"
    intro="Common box dimensions in inches and centimetres: small, medium and large boxes, shipping cubes, mailers, metric cartons, pizza boxes and retail cartons. Enter your product to find the standard box it fits, then make the dieline in that size, free."
    updated="2026-10-26"
    schema={[
      softwareApplicationSchema({ name: 'Standard box size finder', path: page.path, description: page.description, features: ['Standard box sizes in inches and cm', 'Find the smallest standard box a product fits', 'Custom box size with padding', 'Dieline for each size, free'] }),
      { '@type': 'FAQPage', mainEntity: faqs.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
    ]}>
    <BoxSizeFinder slugs={slugs} />

    <div className="btp-sections">
      {BOX_SIZE_GROUPS.map(group => <section key={group.id} id={group.id} className="btp-wide">
        <h2>{group.title}</h2>
        <p>{group.intro}</p>
        <div className="btp-table-wrap">
          <table className="btp-table"><thead><tr><th scope="col">Box</th><th scope="col">Inches</th><th scope="col">cm</th><th scope="col">Volume</th><th scope="col">Use for</th></tr></thead>
            <tbody>{group.boxes.map(box => {
              const sizes = bothUnits(box);
              const space = volume(box);
              return <tr key={box.name}>
                <th scope="row" className="btp-nowrap">{slugs.includes(box.template.slug) ? <Link href={chartBoxHref(box)}>{box.name}</Link> : box.name}</th>
                <td className="btp-nowrap">{sizes.in}</td><td className="btp-nowrap">{sizes.cm}</td>
                <td className="btp-nowrap">{space.cubicFeet} ft³ · {space.litres} L</td>
                <td>{box.use}</td>
              </tr>;
            })}</tbody></table>
        </div>
      </section>)}
      <section>
        <h2>How to read a box size</h2>
        <p>Box sizes are written length × width × height. Length and width are the opening, with length the longer side, and height runs from the opening to the bottom. Stock boxes are quoted by their inside size; the metric cartons above are outside sizes, so the volume shown allows about {CORRUGATED_WALL_MM} mm of board on each wall. <Link href="/blog/how-to-measure-a-box-inside-vs-outside-dimensions">Inside vs outside box dimensions</Link> explains the difference, and <Link href="/blog/standard-box-sizes-carton-mailer-shipping">how to choose a box size</Link> covers when each kind of box is used and when a custom size pays off.</p>
      </section>
      <section>
        <h2>From a size to a dieline</h2>
        <p>Each box name opens its template with the size filled in: the dieline redraws at that size, and you can download it as SVG, PDF, DXF, PNG or a Cricut file with no account, or fold it in 3D. For any other size, use the <Link href="/box-dieline-generator">box dieline generator</Link>.</p>
      </section>
    </div>

    <FaqSection items={faqs} title="Box size questions" links={[{ href: '/box-dieline-generator', label: 'Box dieline generator' }, { href: '/box-templates', label: 'Box templates' }]} />
    <MoreTools exclude={page.path} />
  </LandingPage>;
}
