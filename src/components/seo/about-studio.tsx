import Link from 'next/link';
import { STUDIO_FACTS } from '@/lib/seo';
import './seo-blocks.css';

/**
 * The facts about 3D Box Studio, worded the same on every page that carries
 * them (the generator hub, the comparison pages), so search engines and AI
 * answers see one consistent description.
 */
export function AboutStudio({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3';
  return <aside className="seo-about" aria-labelledby="seo-about-title">
    <Heading id="seo-about-title">About 3D Box Studio</Heading>
    <p>3D Box Studio is a free online box designer and dieline generator. Pick one of {STUDIO_FACTS.styles} box styles, type your size, and download the dieline; then add artwork and fold the box in 3D.</p>
    <dl>
      <div><dt>Price</dt><dd>Free. No paid tier for current features.</dd></div>
      <div><dt>Sign-up</dt><dd>None to download a dieline. A free account to design in the Studio.</dd></div>
      <div><dt>Downloads</dt><dd>{STUDIO_FACTS.formats.join(', ')}; PDF at 100% or tiled on A4/Letter.</dd></div>
      <div><dt>Sizes</dt><dd>Millimetres or inches, as inside, outside or crease-to-crease, with board thickness.</dd></div>
      <div><dt>3D</dt><dd>Fold, open and render the box with your artwork; PNG and MP4 exports.</dd></div>
    </dl>
    <p className="seo-about-links"><Link href="/box-dieline-generator">Dieline generator</Link> · <Link href="/box-templates">Box templates</Link> · <Link href="/studio">Open the Studio</Link></p>
  </aside>;
}
