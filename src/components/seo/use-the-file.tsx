import './seo-blocks.css';

/** How to use the downloaded dieline: the same exports for every style, so the same advice. */
export function UseTheFile({ name }: { name: string }) {
  return <section className="seo-use-file" aria-labelledby="seo-use-file-title">
    <h2 id="seo-use-file-title">How to use the file</h2>
    <div className="seo-use-file-grid">
      <div>
        <h3>Sending it to a printer</h3>
        <p>Send the PDF or the layered SVG. Cut lines are solid red and creases dashed blue, each on its own layer; the bleed line is 3 mm outside the cut, so run background artwork out to it, and keep text inside the safe-zone line, 3 mm in. Ask the printer to confirm the {name} allowances for their board before they make the die.</p>
      </div>
      <div>
        <h3>Cutting tables and laser cutters</h3>
        <p>Use the DXF: millimetres at 1:1, with cut lines on a CUT layer and creases on a CREASE layer, so the machine can cut one and score or kiss-cut the other. The SVG works for laser software that takes vectors.</p>
      </div>
      <div>
        <h3>Cricut and Silhouette</h3>
        <p>Download the Cricut / Silhouette file: an SVG sized in inches with only the cut lines (black) and score lines (blue). In Design Space, set the blue lines to Score and attach. Silhouette Studio Basic can&apos;t open SVG, so use the DXF there.</p>
      </div>
      <div>
        <h3>Printing at home</h3>
        <p>Download the tiled PDF for A4 or Letter. Print at 100% (actual size), check that the scale bar measures 50 mm, then tape the pages together by the crosshair marks and cut out the box.</p>
      </div>
    </div>
  </section>;
}
