import { getBoxTemplatePage, type BoxTemplatePage } from '@/content/box-template-pages';

// Spanish versions of the busiest box template pages (/es/box-templates/<slug>).
// Neutral Spanish for Spain and Latin America. Sizes, presets and geometry come
// from the English page; every claim must match what the template draws, as
// in box-template-pages.ts. The Studio itself is English-only, which the pages say.

export type EsTemplateSection = { title: string; body: string; bullets?: string[] };

export type EsBoxTemplatePage = {
  slug: string;
  name: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  /** Labels and notes for the English page's presets, in the same order. */
  presets: { label: string; note: string }[];
  geometryNote: string;
  sections: EsTemplateSection[];
  faqs: { question: string; answer: string }[];
  updated: string;
};

const FREE_ANSWER = 'Sí. El troquel de esta página se descarga gratis en SVG, PDF, DXF, PNG o como archivo para Cricut, sin cuenta, sin marca de agua y sin límites. Añadir tu diseño y plegar la caja en 3D se hace en el Studio, que necesita una cuenta gratuita y por ahora está en inglés.';

export const ES_BOX_TEMPLATE_PAGES: EsBoxTemplatePage[] = [
  {
    slug: 'reverse-tuck-end-box',
    name: 'Caja de cierre inverso',
    title: 'Plantilla de caja de cierre inverso y troquel gratis | 3D Box Studio',
    description: 'Plantilla gratis de caja de cierre inverso (reverse tuck end). Introduce tus medidas y dibuja el troquel con solapas de cierre, solapas guardapolvo y pestaña de pegado; diséñala y pliégala en 3D.',
    h1: 'Plantilla de caja de cierre inverso',
    intro: 'Introduce las medidas de tu estuche y el troquel de abajo se redibuja al instante: caras frontal, trasera y laterales, una pestaña de pegado cónica, lengüetas de cierre y solapas guardapolvo. Descárgalo gratis o ábrelo en el Studio para colocar tu diseño sobre la plantilla plana, plegarla en 3D y exportar el troquel en PDF a escala 1:1.',
    presets: [
      { label: 'Bálsamo labial / tubo pequeño', note: 'Estuche cosmético estrecho' },
      { label: 'Perfume 50 ml', note: 'Estuche alto y cuadrado' },
      { label: 'Bote de suplementos', note: 'Estuche cuadrado para frasco' },
      { label: 'Estuche de té o alimentación', note: 'Estuche plano de tienda' },
      { label: 'Pastilla de jabón', note: 'Estuche bajo y ancho' },
    ],
    geometryNote: 'Plantilla de corte: lengüetas de cierre con ranuras de bloqueo, solapas guardapolvo con hombro, pestaña de pegado y muesca para el dedo, todo incluido. El ancho, el fondo y el alto son medidas interiores; cada cara se hiende un grosor de cartón más ancha. Pide a tu imprenta que confirme las holguras para su cartón.',
    sections: [
      {
        title: '¿Qué es una caja de cierre inverso?',
        body: 'La caja de cierre inverso (reverse tuck end, RTE) es el estuche plegable más habitual para cosmética, suplementos, alimentación y pequeños productos de tienda. Se corta de una sola plancha de cartoncillo, se pega por una costura lateral y se envía plana. La tapa superior y la inferior salen de caras opuestas: la de arriba cierra desde el frente y la de abajo desde la parte trasera.',
      },
      {
        title: 'Qué incluye el troquel',
        body: 'La plantilla dibuja todas las piezas de un estuche RTE estándar a partir de tus tres medidas.',
        bullets: [
          'Cuatro caras en una tira: frontal, lateral, trasera y lateral.',
          'Una pestaña de pegado con extremos cónicos de 15°, pegada por dentro de la cara trasera.',
          'Tapas superior e inferior en caras opuestas, cada una con lengüeta redondeada y ranuras de bloqueo.',
          'Cuatro solapas guardapolvo con hombro, que se doblan bajo las tapas y sujetan las lengüetas.',
          'Una muesca para el dedo donde entra la lengüeta superior, para abrir el estuche con facilidad.',
          'Líneas de corte y de hendido separadas, igual que en la exportación en PDF.',
        ],
      },
      {
        title: 'Cierre inverso o cierre recto',
        body: 'En una caja de cierre recto (straight tuck end, STE) las dos tapas salen de la misma cara. En 3D Box Studio esa cara es la frontal, así que las dos tapas se doblan desde el borde frontal y cierran por detrás. La caja de cierre inverso pone las tapas en caras opuestas. Así encaja mejor en el pliego de impresión, suele salir más barata y es la opción por defecto, salvo que el diseño necesite un borde frontal limpio. 3D Box Studio tiene las dos: mira la plantilla de [caja de cierre recto](/box-templates/straight-tuck-end-box) (en inglés) para tapas en la misma cara.',
      },
      {
        title: 'Cómo medir una caja de solapas',
        body: 'Mide el producto y añade unos milímetros de holgura por cada lado para que entre con facilidad. El ancho es la cara frontal, el fondo es la cara lateral y el alto va de una tapa a la otra. Los fabricantes de envases suelen escribir la misma caja como largo × ancho × alto (L × A × H), donde L y A describen la abertura y H la altura. Confirma qué convención usa tu imprenta antes de pedir.',
      },
      {
        title: 'Antes de enviarlo a imprenta',
        body: 'Los estuches de tienda suelen imprimirse en cartulina estucada (FBB) o SBS de 300 a 400 g/m². Este troquel toma tus medidas como interiores y hiende cada cara un grosor de cartón más ancha según el calibre que indiques. Tu imprenta puede afinarlo para su cartón y sus hendidores, así que úsalo para diseñar y aprobar la gráfica y pide su troquel o una prueba antes de la tirada.',
      },
    ],
    faqs: [
      { question: '¿La plantilla de caja de cierre inverso es gratis?', answer: FREE_ANSWER },
      { question: '¿Puedo descargar el troquel en PDF, SVG o DXF?', answer: 'Sí. Desde esta página descargas el troquel en SVG por capas, PDF a tamaño real (o en mosaico A4 o Carta), DXF y PNG. En el Studio también puedes exportar un PDF vectorial 1:1 con tu diseño, líneas de corte y hendido, sangrado ajustable y una regla de calibración.' },
      { question: '¿El troquel incluye lengüetas y solapas guardapolvo?', answer: 'Sí. La plantilla dibuja las lengüetas de cierre con ranuras de bloqueo, cuatro solapas guardapolvo con hombro, una pestaña de pegado cónica y una muesca para el dedo, con cada cara hendida un grosor de cartón más ancha que la medida interior que introduces.' },
      { question: '¿Tiene en cuenta el grosor del cartón?', answer: 'Sí. Las medidas que introduces son interiores, y cada cara se hiende un grosor de cartón más ancha según el calibre elegido. Algunas imprentas usan sus propias holguras para un cartón y unas herramientas concretas, así que confírmalo con la tuya antes de producir.' },
      { question: '¿Puedo trabajar en pulgadas?', answer: 'Sí. Cambia la unidad a pulgadas (in) en el generador; el Studio abre la plantilla con la misma unidad.' },
    ],
    updated: '2026-10-19',
  },
  {
    slug: 'mailer-box',
    name: 'Caja postal autoarmable',
    title: 'Plantilla de caja postal (FEFCO 0427) y troquel gratis | 3D Box Studio',
    description: 'Plantilla gratis de caja postal autoarmable para e-commerce (FEFCO 0427). Introduce la medida interior, descarga el troquel, personaliza el exterior y el interior y pliégala en 3D.',
    h1: 'Plantilla de caja postal autoarmable',
    intro: 'La caja de envío para tiendas online que se monta sola: una plancha de cartón ondulado, sin cola, con paredes laterales dobles que se bloquean en la base y una tapa con bisagra que cierra por delante. Introduce la medida interior de tu caja y la plantilla de corte se redibuja. Ábrela en el Studio para diseñar el exterior y el interior del unboxing, plegarla en 3D y exportar mockups o un PDF 1:1.',
    presets: [
      { label: 'Joyería / regalo pequeño', note: 'Caja postal fina' },
      { label: 'Set de cosmética', note: 'Caja de suscripción' },
      { label: 'Ropa', note: 'Camiseta doblada' },
      { label: 'Tamaño caja de zapatos', note: 'Caja postal grande' },
      { label: '9 × 6 × 3 in', note: 'Estándar EE. UU.' },
    ],
    geometryNote: 'Plantilla de corte: paredes frontal y trasera con orejas, paredes laterales dobladas en doble sobre una tira de enrollado con pestañas de bloqueo y ranuras en la base, y una tapa con lengüeta frontal y solapas laterales. El ancho, el fondo y el alto son medidas interiores; la base se corta más ancha para que las paredes dobles queden dentro. Pide a tu fabricante que confirme las holguras para la onda que elijas.',
    sections: [
      {
        title: 'Cómo se construye una caja postal',
        body: 'La caja postal con tapa y laterales enrollados (FEFCO 0427) es una sola plancha troquelada de cartón ondulado, sin cola. Las paredes frontal y trasera se levantan y sus orejas se doblan hacia los lados. Cada pared lateral se levanta por fuera de las orejas y se dobla en doble sobre una tira estrecha; su capa interior encaja en ranuras de la base y atrapa las orejas. La tapa sale de la pared trasera: sus solapas laterales entran dentro de las paredes dobles y su lengüeta frontal se mete por detrás de la pared frontal.',
      },
      {
        title: 'Qué incluye el troquel',
        body: 'La plantilla dibuja todas las piezas a partir de tus tres medidas interiores y del grosor del cartón.',
        bullets: [
          'Base con paredes frontal y trasera, cada una con dos orejas cónicas.',
          'Paredes laterales dobles: pared exterior, tira de enrollado y pared interior con dos pestañas de bloqueo.',
          'Cuatro ranuras en la base para las pestañas de bloqueo.',
          'Tapa con bisagra en la pared trasera, con lengüeta frontal achaflanada y dos solapas laterales.',
          'Líneas de corte y de hendido separadas, igual que en la exportación en PDF.',
        ],
      },
      {
        title: 'Diseñar para el unboxing',
        body: 'Las cajas postales las abre el cliente, así que el interior importa tanto como el exterior. Imprime el interior de la tapa y las paredes interiores con un mensaje, un estampado o el color de tu marca, y deja el exterior sencillo para las etiquetas de envío. En el Studio diseñas las dos caras de la plancha y ves la caja abriéndose en 3D.',
      },
      {
        title: 'Cómo medir una caja postal',
        body: 'Mide el producto, o el conjunto de productos con papel de seda y separadores, y añade unos milímetros de holgura. El ancho va de lado a lado del frente, el fondo de delante hacia atrás y el alto de la base a la tapa. Las paredes laterales dobles ocupan cartón dentro de la caja; la plantilla ya lo tiene en cuenta, así que introduce el espacio que necesitas dentro. Si buscas un punto de partida, consulta las [medidas estándar de cajas](/blog/standard-box-sizes-carton-mailer-shipping) (en inglés).',
      },
    ],
    faqs: [
      { question: '¿La plantilla de caja postal es gratis?', answer: FREE_ANSWER },
      { question: '¿Qué tipo de caja postal es?', answer: 'La caja postal con tapa y laterales enrollados, FEFCO 0427: una sola pieza, sin cola, con paredes laterales dobles bloqueadas en la base y una tapa con lengüeta frontal y solapas laterales. Es el modelo que usan la mayoría de tiendas online y cajas de suscripción.' },
      { question: '¿Las medidas son interiores o exteriores?', answer: 'Interiores. La base y las paredes se cortan más grandes para que la caja plegada conserve la medida interior que introduces, según el grosor de cartón elegido. Pide a tu fabricante que confirme las holguras para su onda y sus herramientas.' },
      { question: '¿Puedo imprimir el interior de la caja?', answer: 'Sí. En el Studio cada cara tiene una superficie exterior y otra interior, así que puedes diseñar la vista del unboxing y exportar las dos caras en el PDF.' },
      { question: '¿Puedo descargar el troquel en SVG o DXF?', answer: 'Sí. Desde esta página lo descargas en SVG por capas y en DXF en milímetros, con las líneas de corte y de hendido en capas separadas, para tu fabricante de cajas o tu mesa de corte.' },
    ],
    updated: '2026-10-19',
  },
  {
    slug: 'pizza-box',
    name: 'Caja de pizza',
    title: 'Plantilla de caja de pizza y troquel gratis con mockup 3D | 3D Box Studio',
    description: 'Plantilla gratis de caja de pizza de 25, 30, 35 y 40 cm (10, 12, 14 y 16 pulgadas). Descarga el troquel, añade tu marca, pliega la caja en 3D y exporta mockups en PNG.',
    h1: 'Plantilla de caja de pizza',
    intro: 'Elige un tamaño de pizza habitual o introduce el tuyo y la plantilla de corte se actualiza: una caja de cartón ondulado de una pieza con frente doble que se bloquea en la base, pestañas en las esquinas y una tapa con bisagra trasera, lengüeta frontal y solapas laterales. Ábrela en el Studio para poner tu marca en la tapa, plegar la caja en 3D y exportar mockups o un PDF 1:1.',
    presets: [
      { label: 'Pizza de 10 in (25 cm)', note: 'Pequeña' },
      { label: 'Pizza de 12 in (30 cm)', note: 'Mediana' },
      { label: 'Pizza de 14 in (35 cm)', note: 'Grande' },
      { label: 'Pizza de 16 in (40 cm)', note: 'Familiar' },
      { label: 'Pizza de 30 cm', note: 'En milímetros' },
    ],
    geometryNote: 'Plantilla de corte: pared frontal doble sobre una tira de enrollado con pestañas de bloqueo y ranuras en la base, pestañas en las esquinas de las paredes laterales, lengüeta y solapas laterales en la tapa, y un hueco para el dedo. Pide a tu fabricante que confirme las holguras para la onda que elijas.',
    sections: [
      {
        title: 'Cómo se construye una caja de pizza',
        body: 'La mayoría de cajas de pizza son una sola plancha troquelada de cartón ondulado, sin cola. Las paredes laterales se levantan y sus pestañas de esquina se doblan hacia dentro; la pared frontal se levanta por fuera de las pestañas y se dobla en doble sobre una tira estrecha, y su capa interior encaja en ranuras de la base y atrapa las pestañas. La tapa sale de la pared trasera, y su lengüeta frontal y sus solapas laterales entran dentro de las paredes para mantenerla cerrada.',
      },
      {
        title: 'Qué incluye la plantilla',
        body: 'La plantilla dibuja las caras sobre las que diseñas a partir del ancho, el fondo y el alto de pared que indiques.',
        bullets: [
          'Base de bandeja con paredes laterales, pared trasera y una pared frontal doble que se bloquea en ranuras de la base.',
          'Cuatro pestañas en las esquinas de las paredes laterales: las dos delanteras quedan atrapadas dentro del frente doble.',
          'Tapa con bisagra en la pared trasera, la superficie principal para la marca, con lengüeta frontal y solapas laterales.',
          'Un hueco para el dedo en el frente, para levantar la tapa.',
        ],
      },
      {
        title: 'Medidas estándar de cajas de pizza',
        body: 'Las cajas se nombran por la pizza que llevan: una caja de 30 cm (12 pulgadas) tiene una base de unos 30 × 30 cm. Las paredes suelen medir entre 4 y 5 cm de alto. Los fabricantes añaden algo de holgura, así que una caja de 30 cm suele medir un poco más por dentro; consulta la ficha técnica del proveedor e introduce sus medidas interiores para que el mockup sea lo más fiel posible.',
      },
      {
        title: 'Diseñar una caja de pizza',
        body: 'La tapa es lo que ve el cliente, así que la mayoría de marcas ponen ahí el logotipo y un mensaje corto y dejan las paredes sencillas. El cartón ondulado absorbe la tinta, y muchas cajas de pizza se imprimen en flexografía a una o dos tintas. Prueba tu diseño sobre material kraft o blanco en el Studio para ver cómo se lee antes de encargar la tirada.',
      },
    ],
    faqs: [
      { question: '¿La plantilla de caja de pizza es gratis?', answer: FREE_ANSWER },
      { question: '¿Qué tamaños puedo hacer?', answer: 'Cualquiera. Los tamaños rápidos cubren cajas de 10, 12, 14 y 16 pulgadas y una caja de 30 cm, y puedes escribir tu propio ancho, fondo y alto de pared en milímetros o pulgadas.' },
      { question: '¿Es un troquel de caja de pizza listo para producción?', answer: 'Es una plantilla de corte real, con el frente doble que se bloquea, las ranuras, las pestañas de esquina, las solapas de la tapa y el hueco para el dedo, calculada con tus medidas interiores y el grosor del cartón. Pide a tu fabricante que confirme las holguras para la onda que usa antes de producir.' },
      { question: '¿Puedo exportar el diseño de la caja de pizza?', answer: 'Sí. El Studio exporta mockups en PNG desde la vista 3D y un PDF 1:1 con tu diseño, líneas de corte y hendido y sangrado ajustable. La plantilla de corte sola se descarga desde esta página en SVG o DXF para tu fabricante.' },
    ],
    updated: '2026-10-19',
  },
  {
    slug: 'split-top-box',
    name: 'Caja americana',
    title: 'Plantilla de caja americana (FEFCO 0201) y troquel gratis | 3D Box Studio',
    description: 'Plantilla gratis de caja americana de cartón para envíos (FEFCO 0201 y 0204). Introduce la medida interior, descarga el troquel con sus cuatro solapas por lado y diséñala por fuera y por dentro en 3D.',
    h1: 'Plantilla de caja americana',
    intro: 'La caja de cartón ondulado de envío de toda la vida: una caja de solapas cuyas solapas exteriores se encuentran en el centro y dividen la tapa en dos. Introduce la medida interior y la plantilla de corte se redibuja; ábrela en el Studio para diseñar el exterior y el interior, abrir las solapas en 3D y exportar mockups o un PDF 1:1.',
    presets: [
      { label: 'Caja de envío pequeña', note: 'Libros, productos pequeños' },
      { label: 'Caja de envío mediana', note: 'E-commerce en general' },
      { label: 'Caja de envío grande', note: 'Artículos voluminosos' },
      { label: '12 × 12 × 12 in', note: 'Cubo' },
    ],
    geometryNote: 'Plantilla de corte: una caja de solapas para envíos con cuatro solapas en cada extremo, ranuras entre ellas y una pestaña de unión pegada, hendida un grosor de cartón más ancha que la medida interior que introduces. Aquí se dibuja con todas las solapas superiores encontrándose en el centro (FEFCO 0204); en el Studio puedes cambiar a la caja americana normal (FEFCO 0201).',
    sections: [
      {
        title: 'Para qué sirve esta plantilla',
        body: 'Usa la caja americana para envíos y cajas de suscripción: paredes exteriores con tu marca, un interior impreso y dos solapas exteriores que se abren desde el centro. El PDF es una plantilla de corte con ranuras que tu fabricante de cajas puede presupuestar.',
      },
      {
        title: 'Qué incluye la plantilla',
        body: 'La plantilla dibuja las caras sobre las que puedes diseñar a partir de tu ancho, alto y fondo.',
        bullets: [
          'Cuatro paredes en una tira con una pestaña de unión cónica (35 mm en cartón ondulado).',
          'Cuatro solapas en cada extremo, con ranuras para que se doblen unas sobre otras.',
          'Solapas exteriores que se encuentran en el centro de la tapa, en el frente y la trasera (FEFCO 0201) o en los extremos (FEFCO 0204).',
          'Diseño exterior e interior por separado en el Studio.',
        ],
      },
      {
        title: 'Caja americana o caja de solapas estándar',
        body: 'La caja americana (en inglés, regular slotted container o RSC) es la caja de envío estándar de cartón ondulado: cuatro solapas en cada extremo, dos mayores que se encuentran en el centro y dos menores debajo. Esta plantilla las dibuja todas, con ranuras entre las solapas, una pestaña de unión pegada y holguras de hendido para el grosor de cartón que elijas (hasta 7 mm para doble canal).',
      },
      {
        title: 'Diseñar el unboxing',
        body: 'Imprimir el interior de una caja de envío es una forma barata de hacer memorable el unboxing. En el Studio diseñas el exterior y el interior por separado, abres las solapas en 3D y exportas imágenes PNG para tu tienda, tus redes o un briefing para el proveedor. Para elegir el tamaño, consulta las [medidas estándar de cajas](/blog/standard-box-sizes-carton-mailer-shipping) (en inglés).',
      },
    ],
    faqs: [
      { question: '¿La plantilla de caja americana es gratis?', answer: FREE_ANSWER },
      { question: '¿Puedo imprimir el interior de la caja?', answer: 'Sí. En el Studio esta plantilla tiene diseño exterior e interior por separado, y la vista 3D abre las solapas para que revises los dos.' },
      { question: '¿Es lo mismo que una caja de envío estándar?', answer: 'Sí. Es una caja americana (FEFCO 0201), o una caja de solapas centradas (FEFCO 0204) si pones las solapas exteriores en los extremos. Pide a tu fabricante que confirme las holguras de hendido para la onda que elijas.' },
      { question: '¿Puedo trabajar en pulgadas?', answer: 'Sí. Cambia el generador a pulgadas (in); el Studio se abre con la misma unidad.' },
      { question: '¿Puedo descargar la plantilla de corte?', answer: 'Sí. Desde esta página la descargas en SVG, PDF, DXF y PNG. El Studio exporta además un PDF 1:1 con tu diseño.' },
    ],
    updated: '2026-10-19',
  },
  {
    slug: 'pillow-box',
    name: 'Caja almohada',
    title: 'Plantilla de caja almohada y troquel gratis | 3D Box Studio',
    description: 'Plantilla gratis de caja almohada. Introduce tus medidas y dibuja el troquel con sus hendidos curvos, solapas de cierre y pestaña de pegado; diséñala y mírala cerrarse en 3D.',
    h1: 'Plantilla de caja almohada',
    intro: 'Introduce las medidas de tu caja almohada cerrada y el troquel de abajo se redibuja al instante: dos caras, un hendido curvo y una solapa de cierre en cada extremo de ambas caras, y una pestaña de pegado. Descárgalo gratis o ábrelo en el Studio para diseñarla, ver cómo se curvan las caras y se cierran los extremos en 3D y exportar el troquel 1:1 en PDF, SVG o DXF.',
    presets: [
      { label: 'Joyería', note: 'Collar o pulsera' },
      { label: 'Tarjeta regalo', note: 'Almohada fina' },
      { label: 'Detalle para invitados', note: 'Dulces o jabón' },
      { label: 'Calcetines o pañuelo', note: 'Ropa' },
      { label: '4 × 3 × 1 in', note: 'Almohada regalo EE. UU.' },
    ],
    geometryNote: 'Plantilla de corte: una cara frontal y otra trasera unidas por un hendido recto, cada una con un hendido curvo en los dos extremos y una solapa curva más allá, y una pestaña de pegado cuyos extremos siguen los hendidos. Sin cola en los extremos. El ancho, el fondo y el alto son medidas exteriores de la almohada cerrada: de punta a punta, de lado a lado y el grosor en el centro. Las caras se cortan tan anchas como su curva. Pide a tu imprenta que confirme los hendidos curvos para su cartón.',
    sections: [
      {
        title: '¿Qué es una caja almohada?',
        body: 'Una caja almohada es un estuche pequeño con dos caras abombadas y extremos curvos, con forma de almohada. Se corta de una sola pieza de cartón, se pega por un lado y se envía plana; para cerrarla, empujas los extremos curvos hacia dentro y se bloquean entre sí sin lengüetas ni cola. Es una de las favoritas para joyería, tarjetas regalo, detalles para invitados, muestras de cosmética y pequeños accesorios, porque queda elegante y usa poco cartón.',
      },
      {
        title: 'Qué incluye el troquel',
        body: 'La plantilla dibuja todas las piezas a partir de tus tres medidas.',
        bullets: [
          'Una cara frontal y otra trasera, cada una tan ancha como su curva en la caja cerrada, unidas por un hendido que forma uno de los bordes.',
          'Un hendido curvo en cada extremo de las dos caras, que se mete en la cara: cuanto más profundo, más largo es el estrechamiento hasta el extremo cerrado.',
          'Una solapa curva más allá de cada hendido, tan profunda como hace falta para llegar al centro del extremo cerrado.',
          'Una pestaña de pegado a lo largo de la cara trasera, cuyos extremos siguen los hendidos de la cara frontal para que quede oculta dentro.',
          'Ancho de la pestaña de pegado ajustable en el Studio.',
          'Líneas de corte y de hendido separadas, igual que en las exportaciones en PDF, SVG y DXF.',
        ],
      },
      {
        title: 'Cómo plegar una caja almohada',
        body: 'Marca primero bien los hendidos curvos: son los que hacen funcionar la caja. Dobla por el hendido recto entre las dos caras, pega la pestaña por dentro del borde frontal y deja secar. Aprieta los lados para que las caras se abomben, empuja un extremo curvo hacia dentro hasta que las dos solapas se encuentren en el centro, llena la caja y cierra el otro extremo igual. En el Studio puedes ver cómo se curvan las caras y se cierran los extremos en 3D.',
      },
      {
        title: 'Cómo elegir el tamaño',
        body: 'Mide el producto y deja algo de espacio: la almohada es más gruesa en el centro y se estrecha hacia los extremos, así que el producto debe caber holgado en el tercio central del largo. Mantén el alto en no más de dos tercios del fondo, o las caras no podrán abombarse lo suficiente para cerrar. Para algo plano como una tarjeta regalo funciona bien una almohada fina de 20 a 25 mm de grosor; para joyería o jabón, de 30 a 40 mm.',
      },
    ],
    faqs: [
      { question: '¿La plantilla de caja almohada es gratis?', answer: FREE_ANSWER },
      { question: '¿Las medidas son interiores o exteriores?', answer: 'Exteriores. El ancho es la almohada cerrada de punta a punta, el fondo es de lado a lado y el alto es su grosor en el centro. El interior es algo más pequeño, y menos hacia los extremos, donde la almohada se estrecha.' },
      { question: '¿Una caja almohada necesita cola?', answer: 'Solo una vez, en la pestaña de pegado que cierra el tubo. Los extremos se cierran empujando las solapas curvas, sin cola ni lengüetas, así que la caja se puede abrir y cerrar de nuevo.' },
      { question: '¿Puedo descargar el troquel?', answer: 'Sí. Desde esta página lo descargas en SVG, PDF, DXF, PNG o para Cricut, con las líneas de corte y de hendido separadas. Los hendidos curvos se dibujan como tramos rectos cortos, como los cortan los troqueladores. Pide a tu imprenta que confirme los hendidos para su cartón.' },
    ],
    updated: '2026-10-19',
  },
];

export const ES_TEMPLATE_SLUGS = ES_BOX_TEMPLATE_PAGES.map(page => page.slug);

export function getEsBoxTemplatePage(slug: string): { es: EsBoxTemplatePage; en: BoxTemplatePage } | undefined {
  const es = ES_BOX_TEMPLATE_PAGES.find(page => page.slug === slug);
  const en = es ? getBoxTemplatePage(slug) : undefined;
  return es && en ? { es, en } : undefined;
}

/** hreflang for a template page that has a Spanish version. */
export function templateLanguageAlternates(slug: string) {
  return { en: `/box-templates/${slug}`, es: `/es/box-templates/${slug}`, 'x-default': `/box-templates/${slug}` };
}
