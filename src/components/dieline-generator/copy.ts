import type { DimensionMode, LineType } from "@/lib/dieline/types";

// The dieline generator's own words, in each language a page can show it in.
// Panel names, flap option names and engine warnings come from the styles
// and stay in English.

export type GeneratorLocale = "en" | "es";
export type GeneratorExportId = "pdf" | "pdf_a4" | "pdf_letter" | "svg" | "dxf" | "png" | "cricut";
type FieldKey = "length" | "width" | "depth";

export type PreviewCopy = {
  zoom: string; zoomOut: string; zoomIn: string; fit: string; zoomLevel: (percent: number) => string; dragHint: string; handle: (label: string) => string;
  /** Legend names; English comes from the SVG export's own names. */
  lineNames?: Partial<Record<LineType, string>>;
};

export type GeneratorCopy = {
  tagline: string;
  styleGroup: string;
  commonSizes: string;
  show: string; names: string; sizes: string;
  settings: string; size: string; units: string; measuredAs: string;
  modes: Record<DimensionMode, { label: string; hint: string }>;
  fields: Record<FieldKey, { letter: string; label: string; hint: string }>;
  /** Styles whose three sizes mean something else (a hexagon box's across the flats and lid depth). */
  styleFields: Record<string, Partial<Record<FieldKey, { letter: string; label: string; hint: string }>>>;
  fieldLabel: (label: string, unit: string, hint: string) => string;
  board: string; material: string; custom: string; thickness: (points: number) => string;
  window: string; windowToggle: string; windowBorder: string;
  flaps: string; flapsHint: string; flapRange: (label: string, min: number, max: number, unit: string) => string;
  flatSheet: string; inside: string; cricutMat: string; cricutFits: string; tooLarge: string;
  exportTitle: string; fileType: string; making: string; download: (short: string) => string; noAccount: string;
  exports: Record<GeneratorExportId, { label: string; short: string; hint: string }>;
  howToCut: string; cricutSteps?: string[];
  open3d: string; copyLink: string; linkCopied: string; copyPrompt: string; note: string;
  enterAbove: (field: string) => string; overThreeMetres: (field: string) => string; thicknessRange: string; cantDraw: string; fileFailed: string;
  dielineLabel: (style: string, size: string, mode: string, sheet: string | null) => string;
  materials: Record<string, string>;
  styleNames: Record<string, string>;
  drag: string;
  preview: PreviewCopy;
};

const en: GeneratorCopy = {
  tagline: "Free · no account · SVG, PDF, DXF, PNG and Cricut",
  styleGroup: "Box style",
  commonSizes: "Common sizes",
  show: "Show", names: "Names", sizes: "Sizes",
  settings: "Box settings", size: "Size", units: "Units", measuredAs: "Measured as",
  modes: {
    inner: { label: "Inside", hint: "The space inside the box: what your product needs." },
    outer: { label: "Outside", hint: "The outside of the closed box, for shipping and shelf space." },
    manufacture: { label: "Manufacture", hint: "Crease to crease on the flat sheet, as a printer quotes it." },
  },
  fields: {
    length: { letter: "L", label: "Length", hint: "the opening's long side" },
    width: { letter: "W", label: "Width", hint: "the opening's short side" },
    depth: { letter: "D", label: "Depth", hint: "the height" },
  },
  styleFields: {
    "hexagon-box": {
      length: { letter: "F", label: "Across flats", hint: "the inside, from one flat side to the one opposite" },
      width: { letter: "L", label: "Lid depth", hint: "how far the lid comes down over the base" },
      depth: { letter: "H", label: "Height", hint: "the inside height of the base" },
    },
  },
  fieldLabel: (label, unit, hint) => `${label} in ${unit}, ${hint}`,
  board: "Board", material: "Material", custom: "Custom", thickness: points => `Board thickness, ${points} pt`,
  window: "Window", windowToggle: "Cut a window in the lid", windowBorder: "Border round the window",
  flaps: "Flaps and allowances", flapsHint: "Blank uses the style's own size for your box.",
  flapRange: (label, min, max, unit) => `${label}, ${min} to ${max} ${unit}`,
  flatSheet: "Flat sheet", inside: "Inside", cricutMat: "Cricut mat", cricutFits: "Fits 12 × 24 in", tooLarge: "Too large",
  exportTitle: "Export", fileType: "File type", making: "Making…", download: short => `Download ${short}`, noAccount: "No account, no watermark.",
  exports: {
    pdf: { short: "PDF", label: "PDF · 100%, one page", hint: "Vector, at exact size, with a legend and a 50 mm scale bar." },
    pdf_a4: { short: "tiled PDF", label: "PDF · tiled on A4", hint: "For a home printer: print at 100% and tape the pages by the marks." },
    pdf_letter: { short: "tiled PDF", label: "PDF · tiled on Letter", hint: "For a home printer: print at 100% and tape the pages by the marks." },
    svg: { short: "SVG", label: "SVG · layered", hint: "For Illustrator, Inkscape and Affinity: a layer per line type." },
    dxf: { short: "DXF", label: "DXF · CAD", hint: "For CAD, die makers and cutting tables: mm, CUT and CREASE layers." },
    png: { short: "PNG", label: "PNG · 300 dpi", hint: "A picture of the dieline, for proofs and listings." },
    cricut: { short: "Cricut file", label: "Cricut / Silhouette SVG", hint: "Cut lines in black, score lines in blue, sized in inches." },
  },
  howToCut: "How to cut it",
  open3d: "Open in 3D Box Studio", copyLink: "Copy link to this box", linkCopied: "Link copied", copyPrompt: "Copy this link:",
  note: "The Studio adds your artwork and folds the box in 3D; it needs a free account. Check the board and allowances with your printer before production.",
  enterAbove: field => `Enter a ${field.toLowerCase()} above zero.`,
  overThreeMetres: field => `The ${field.toLowerCase()} is over 3 metres. Check the units.`,
  thicknessRange: "Enter a board thickness between 0.1 and 10 mm.",
  cantDraw: "This box can't be drawn at these sizes.",
  fileFailed: "The file couldn't be made.",
  dielineLabel: (style, size, mode, sheet) => `Flat dieline of a ${style.toLowerCase()}, ${size} (${mode.toLowerCase()}); the flat sheet is ${sheet}.`,
  materials: {},
  styleNames: {},
  drag: "Drag to change",
  preview: {
    zoom: "Zoom", zoomOut: "Zoom out", zoomIn: "Zoom in", fit: "Fit to screen",
    zoomLevel: percent => `${percent}% zoom: fit the sheet`,
    dragHint: "Drag the blue handles to resize",
    handle: label => `${label}: drag or use the arrow keys`,
  },
};

const es: GeneratorCopy = {
  tagline: "Gratis · sin cuenta · SVG, PDF, DXF, PNG y Cricut",
  styleGroup: "Estilo de caja",
  commonSizes: "Medidas habituales",
  show: "Mostrar", names: "Nombres", sizes: "Medidas",
  settings: "Ajustes de la caja", size: "Medidas", units: "Unidades", measuredAs: "Tipo de medida",
  modes: {
    inner: { label: "Interior", hint: "El espacio dentro de la caja: lo que necesita tu producto." },
    outer: { label: "Exterior", hint: "El exterior de la caja cerrada, para el envío y el espacio en el lineal." },
    manufacture: { label: "Fabricación", hint: "De hendido a hendido sobre la plancha, como la presupuesta la imprenta." },
  },
  fields: {
    length: { letter: "L", label: "Largo", hint: "el lado largo de la abertura" },
    width: { letter: "A", label: "Ancho", hint: "el lado corto de la abertura" },
    depth: { letter: "H", label: "Alto", hint: "la altura" },
  },
  styleFields: {
    "hexagon-box": {
      length: { letter: "C", label: "Entre caras", hint: "el interior, de una cara plana a la opuesta" },
      width: { letter: "T", label: "Alto de la tapa", hint: "cuánto baja la tapa sobre la base" },
      depth: { letter: "H", label: "Alto", hint: "la altura interior de la base" },
    },
  },
  fieldLabel: (label, unit, hint) => `${label} en ${unit}, ${hint}`,
  board: "Cartón", material: "Material", custom: "Personalizado", thickness: points => `Grosor del cartón, ${points} pt`,
  window: "Ventana", windowToggle: "Recortar una ventana en la tapa", windowBorder: "Margen alrededor de la ventana",
  flaps: "Solapas y holguras", flapsHint: "Si lo dejas en blanco, se usa la medida propia del estilo para tu caja.",
  flapRange: (label, min, max, unit) => `${label}, de ${min} a ${max} ${unit}`,
  flatSheet: "Plancha", inside: "Interior", cricutMat: "Tapete Cricut", cricutFits: "Cabe en 12 × 24 in", tooLarge: "Demasiado grande",
  exportTitle: "Exportar", fileType: "Tipo de archivo", making: "Generando…", download: short => `Descargar ${short}`, noAccount: "Sin cuenta ni marca de agua.",
  exports: {
    pdf: { short: "PDF", label: "PDF · 100 %, una página", hint: "Vectorial, a tamaño real, con leyenda y una barra de escala de 50 mm." },
    pdf_a4: { short: "PDF en mosaico", label: "PDF · en mosaico A4", hint: "Para una impresora doméstica: imprime al 100 % y une las hojas con cinta por las marcas." },
    pdf_letter: { short: "PDF en mosaico", label: "PDF · en mosaico Carta", hint: "Para una impresora doméstica: imprime al 100 % y une las hojas con cinta por las marcas." },
    svg: { short: "SVG", label: "SVG · por capas", hint: "Para Illustrator, Inkscape y Affinity: una capa por tipo de línea." },
    dxf: { short: "DXF", label: "DXF · CAD", hint: "Para CAD, troquelistas y mesas de corte: en mm, con capas CUT y CREASE." },
    png: { short: "PNG", label: "PNG · 300 ppp", hint: "Una imagen del troquel, para pruebas y fichas de producto." },
    cricut: { short: "archivo Cricut", label: "SVG para Cricut / Silhouette", hint: "Líneas de corte en negro y de hendido en azul, en pulgadas." },
  },
  howToCut: "Cómo cortarlo",
  cricutSteps: [
    "Sube el SVG a Cricut Design Space (Upload > Upload Image) o ábrelo en Silhouette Studio Designer Edition o superior. Silhouette Studio Basic no abre SVG: usa el archivo DXF.",
    "Comprueba el tamaño antes de cortar: debe coincidir con la medida de la plancha que ves aquí. Si no coincide, desbloquea las proporciones y escribe el ancho.",
    "En Design Space, desagrupa el diseño, selecciona las líneas azules y cambia su operación a Score (o Draw con un estilete de hendido); después usa Attach para que los hendidos no se muevan.",
    "En un tapete Cricut de 12 × 24 in el corte máximo es de unos 292 × 597 mm. Las cajas más grandes hay que dividirlas o cortarlas en una mesa de corte.",
  ],
  open3d: "Abrir en 3D Box Studio", copyLink: "Copiar enlace a esta caja", linkCopied: "Enlace copiado", copyPrompt: "Copia este enlace:",
  note: "El Studio añade tu diseño y pliega la caja en 3D; necesita una cuenta gratuita y por ahora está en inglés. Confirma el cartón y las holguras con tu imprenta antes de producir.",
  enterAbove: field => `Introduce un ${field.toLowerCase()} mayor que cero.`,
  overThreeMetres: field => `El ${field.toLowerCase()} supera los 3 metros. Revisa las unidades.`,
  thicknessRange: "Introduce un grosor de cartón entre 0,1 y 10 mm.",
  cantDraw: "Esta caja no se puede dibujar con estas medidas.",
  fileFailed: "No se ha podido generar el archivo.",
  dielineLabel: (style, size, mode, sheet) => `Troquel plano: ${style.toLowerCase()}, ${size} (medidas ${mode.toLowerCase()}); la plancha mide ${sheet}.`,
  materials: {
    sbs18: "Cartulina SBS 18 pt",
    sbs24: "Cartulina SBS 24 pt",
    fbb350: "Cartulina estucada FBB 350 g/m²",
    eflute: "Cartón ondulado canal E",
    bflute: "Cartón ondulado canal B",
    grey2: "Cartón gris de 2 mm (rígido)",
  },
  styleNames: {
    "reverse-tuck-end": "Caja de cierre inverso",
    "straight-tuck-end": "Caja de cierre recto",
    "snap-lock-bottom": "Caja con fondo semiautomático (1-2-3)",
    "auto-lock-bottom": "Caja con fondo automático",
    "mailer-box": "Caja postal autoarmable",
    "shipping-box-rsc": "Caja americana de envío",
    "pillow-box": "Caja almohada",
    "gable-box": "Caja con asa (gable)",
    "sleeve-box": "Funda",
    "pizza-box": "Caja de pizza",
    "drawer-box": "Caja cajón (bandeja y funda)",
    "rigid-lid-and-base": "Caja rígida de tapa y fondo",
    "four-corner-tray": "Bandeja de cuatro esquinas",
    "telescope-box": "Caja telescópica (bandeja con tapa)",
    "cake-box": "Caja de tarta (esquinas bloqueadas, ventana opcional)",
    "hexagon-box": "Caja hexagonal (base y tapa)",
  },
  drag: "Arrastra para cambiar",
  preview: {
    zoom: "Zoom", zoomOut: "Alejar", zoomIn: "Acercar", fit: "Ajustar a la pantalla",
    zoomLevel: percent => `Zoom al ${percent} %: ajustar la plancha`,
    dragHint: "Arrastra los tiradores azules para cambiar el tamaño",
    handle: label => `${label}: arrastra o usa las flechas del teclado`,
    lineNames: { cut: "Corte", crease: "Hendido (pliegue)", perforation: "Perforado", glue: "Zona de pegado", bleed: "Sangrado (3 mm)", safe: "Zona segura (3 mm)" },
  },
};

export const GENERATOR_COPY: Record<GeneratorLocale, GeneratorCopy> = { en, es };

/** The three size fields as `style` names them. */
export function fieldsFor(copy: GeneratorCopy, style: string): GeneratorCopy["fields"] {
  return { ...copy.fields, ...copy.styleFields[style] };
}
