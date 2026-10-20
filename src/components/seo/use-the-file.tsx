import './seo-blocks.css';

/** How to use the downloaded dieline: the same exports for every style, so the same advice. */
export function UseTheFile({ name, locale = 'en' }: { name: string; locale?: 'en' | 'es' }) {
  if (locale === 'es') return <UseTheFileEs name={name} />;
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

function UseTheFileEs({ name }: { name: string }) {
  return <section className="seo-use-file" aria-labelledby="seo-use-file-title" lang="es">
    <h2 id="seo-use-file-title">Cómo usar el archivo</h2>
    <div className="seo-use-file-grid">
      <div>
        <h3>Para enviarlo a la imprenta</h3>
        <p>Envía el PDF o el SVG por capas. Las líneas de corte son rojas y continuas y los hendidos azules y discontinuos, cada tipo en su capa; la línea de sangrado está 3 mm por fuera del corte, así que lleva los fondos hasta ella, y deja los textos dentro de la zona segura, 3 mm hacia dentro. Pide a la imprenta que confirme las holguras de la {name} para su cartón antes de hacer el troquel.</p>
      </div>
      <div>
        <h3>Mesas de corte y láser</h3>
        <p>Usa el DXF: en milímetros a escala 1:1, con las líneas de corte en la capa CUT y los hendidos en la capa CREASE, para que la máquina corte unas y hienda o semicorte las otras. El SVG sirve para programas de láser que trabajan con vectores.</p>
      </div>
      <div>
        <h3>Cricut y Silhouette</h3>
        <p>Descarga el archivo para Cricut / Silhouette: un SVG en pulgadas solo con las líneas de corte (negro) y de hendido (azul). En Design Space, cambia las líneas azules a Score y usa Attach. Silhouette Studio Basic no abre SVG: usa el DXF.</p>
      </div>
      <div>
        <h3>Imprimir en casa</h3>
        <p>Descarga el PDF en mosaico para A4 o Carta. Imprime al 100 % (tamaño real), comprueba que la barra de escala mide 50 mm, une las hojas con cinta por las marcas de cruz y recorta la caja.</p>
      </div>
    </div>
  </section>;
}
