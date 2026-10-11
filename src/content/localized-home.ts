// Translated landing pages for the localized home routes (/es, /es-mx, /fr,
// /pt-br, /de, /zh). The Studio itself is English-only, which each page says.
// Keep product facts in line with the English home page and the FAQ.

export const localizedHomeLocales = ['es', 'es-mx', 'fr', 'pt-br', 'de', 'zh'] as const;
export type LocalizedHomeLocale = (typeof localizedHomeLocales)[number];

type Item = { title: string; body: string };
type Faq = { question: string; answer: string };

export type LocalizedHomeContent = {
  /** BCP 47 tag for `lang` and hreflang. */
  lang: string;
  /** Open Graph locale, e.g. es_ES. */
  ogLocale: string;
  /** Language name in its own language, for the language switcher. */
  nativeName: string;
  title: string;
  description: string;
  nav: { features: string; templates: string; faq: string; guides: string; openStudio: string; languages: string; skip: string; openMenu: string; closeMenu: string };
  hero: { badge: string; line1: string; line2: string; intro: string; primaryCta: string; secondaryCta: string; proof: [string, string, string]; appNote: string };
  steps: { eyebrow: string; title: string; items: [Item, Item, Item]; alts: [string, string, string] };
  features: { eyebrow: string; title: string; items: Item[] };
  faq: { eyebrow: string; title: string; items: Faq[] };
  closing: { title: string; body: string; cta: string; note: string };
  footer: { tagline: string; product: string; company: string; studio: string; guides: string; faq: string; contact: string; privacy: string; terms: string; cookies: string };
};

export const englishHomeLanguage = { lang: 'en', nativeName: 'English', path: '/' } as const;

export const localizedHome: Record<LocalizedHomeLocale, LocalizedHomeContent> = {
  es: {
    lang: 'es',
    ogLocale: 'es_ES',
    nativeName: 'Español (España)',
    title: 'Diseñador de cajas 3D y mockups gratis | 3D Box Studio',
    description: 'Generador de cajas 3D online y gratuito: medidas exactas, diseño sobre el troquel, vista 3D que se pliega, vídeo MP4 y troquel en PDF, SVG o DXF a escala 1:1. Cuenta gratuita.',
    nav: { features: 'Funciones', templates: 'Plantillas de cajas', faq: 'Preguntas', guides: 'Guías', openStudio: 'Abrir Studio', languages: 'Idioma', skip: 'Saltar al contenido', openMenu: 'Abrir menú', closeMenu: 'Cerrar menú' },
    hero: {
      badge: 'Generador de cajas 3D y mockups gratis',
      line1: 'Diseña la caja.',
      line2: 'Mírala en 3D.',
      intro: '3D Box Studio es un creador de cajas 3D online y gratuito. Elige un tipo de caja, introduce las medidas exactas, coloca tu diseño sobre el troquel, pliégalo en 3D y exporta un mockup en PNG o un troquel en PDF listo para imprenta. Solo necesitas una cuenta gratuita, sin instalar nada.',
      primaryCta: 'Empezar a diseñar gratis',
      secondaryCta: 'Cómo funciona',
      proof: ['Sin instalación', '2D y 3D en un solo flujo', 'Cuenta gratuita'],
      appNote: 'Por ahora el editor está en inglés.',
    },
    steps: {
      eyebrow: 'Cómo funciona',
      title: 'Tres pasos, de las medidas al mockup terminado',
      items: [
        { title: '1. Caja', body: 'Elige la estructura, introduce ancho, alto y fondo en milímetros o pulgadas y escoge el material.' },
        { title: '2. Diseño', body: 'Coloca tus imágenes sobre el troquel plano, por fuera y por dentro, con guías de corte, hendido y sangrado. La vista 3D se actualiza al instante.' },
        { title: '3. Vista previa y descarga', body: 'Pliega la caja de plana a cerrada, gírala en 3D y exporta un mockup en PNG, un vídeo MP4 o el troquel en PDF, SVG o DXF a tamaño real.' },
      ],
      alts: [
        'Panel Caja y tamaño de 3D Box Studio con medidas de ancho, alto y fondo junto a una caja kraft en 3D',
        'Lienzo de diseño de 3D Box Studio con imágenes colocadas sobre el troquel y vista 3D en directo',
        'Vista previa 3D de una caja impresa y montada, con el control de plegado de plana a cerrada',
      ],
    },
    features: {
      eyebrow: 'Funciones',
      title: 'Todo lo que necesitas para revisar un packaging antes de imprimir',
      items: [
        { title: 'Medidas exactas', body: 'Ancho, alto y fondo en mm o pulgadas. El troquel 2D y el modelo 3D salen de las mismas medidas.' },
        { title: 'Diseño sobre el troquel', body: 'Sube PNG, JPG, WebP o SVG y colócalos por fuera y por dentro de la caja, con capas que puedes mover, escalar y girar.' },
        { title: 'Plegado en 3D', body: 'Pasa de la caja plana a la caja cerrada con un solo control y revisa cada cara antes de imprimir.' },
        { title: 'Materiales', body: 'Cartón blanco, kraft, soft touch, mate, brillo y foil para ver cómo cambia el acabado.' },
        { title: 'PNG, MP4 y troquel 1:1', body: 'Mockups en PNG y un vídeo MP4 de la caja plegándose para tiendas online y redes, un PDF del troquel a escala real con sangrado, y la plantilla de corte en SVG o DXF.' },
        { title: 'Guardar y compartir', body: 'Tus proyectos se guardan en tu cuenta y puedes enviar un enlace 3D de solo lectura a clientes o compañeros.' },
      ],
    },
    faq: {
      eyebrow: 'Preguntas frecuentes',
      title: 'Preguntas frecuentes',
      items: [
        { question: '¿3D Box Studio es gratis?', answer: 'Sí. Es gratuito y funciona en el navegador. Para usar el Studio, guardar y exportar necesitas una cuenta gratuita, que puedes crear con Google o con tu correo.' },
        { question: '¿Qué tipos de caja puedo diseñar?', answer: 'Estuche con solapas invertidas, estuche con cierre recto, caja de envío con tapa dividida, caja de pizza, caja mailer (FEFCO 0427), caja con funda y caja rígida con tapa y base. Puedes ajustar el tamaño de cada solapa. La caja de cajón llegará pronto.' },
        { question: '¿Qué puedo exportar?', answer: 'Mockups en PNG desde la vista 3D, un vídeo MP4 de unos 10 segundos de la caja plegándose y girando, un troquel en PDF vectorial a escala 1:1 (cara exterior o interior, con sangrado y líneas de corte y hendido) y la plantilla de corte en SVG o DXF.' },
        { question: '¿El troquel está listo para producción?', answer: 'Es una plantilla de corte real a escala 1:1, calculada a partir de tus medidas y del grosor del cartón, útil para pruebas, muestras y presupuestos. Antes de fabricar, confirma con tu imprenta sus tolerancias y su utillaje.' },
        { question: '¿Está en español?', answer: 'Esta página sí; el editor está en inglés por ahora, pero es muy visual y se basa en tres pasos: Caja, Diseño y Vista previa.' },
      ],
    },
    closing: { title: 'Tu próximo packaging empieza aquí', body: 'Crea una cuenta gratuita, elige una caja, ajusta las medidas y revisa tu diseño en 3D.', cta: 'Empezar a diseñar gratis', note: 'Cuenta gratuita · Regístrate con Google o con tu correo' },
    footer: { tagline: 'Ideas de packaging, hechas tangibles.', product: 'Producto', company: 'Empresa', studio: 'Studio', guides: 'Guías', faq: 'Preguntas frecuentes', contact: 'Contacto', privacy: 'Privacidad', terms: 'Condiciones', cookies: 'Configurar cookies' },
  },

  'es-mx': {
    lang: 'es-MX',
    ogLocale: 'es_MX',
    nativeName: 'Español (México)',
    title: 'Diseñador de cajas 3D y empaques gratis | 3D Box Studio',
    description: 'Crea cajas en 3D gratis en línea: medidas exactas, diseño sobre el suaje, vista 3D que se arma, video MP4 y suaje en PDF, SVG o DXF a escala 1:1. Cuenta gratuita.',
    nav: { features: 'Funciones', templates: 'Plantillas de cajas', faq: 'Preguntas', guides: 'Guías', openStudio: 'Abrir Studio', languages: 'Idioma', skip: 'Ir al contenido', openMenu: 'Abrir menú', closeMenu: 'Cerrar menú' },
    hero: {
      badge: 'Generador de cajas 3D y mockups de empaque gratis',
      line1: 'Diseña la caja.',
      line2: 'Mírala en 3D.',
      intro: '3D Box Studio es un creador de cajas 3D en línea y gratuito. Elige un tipo de caja, captura las medidas exactas, coloca tu arte sobre el suaje, ármala en 3D y exporta un mockup en PNG o el suaje en PDF listo para imprenta. Solo necesitas una cuenta gratis, sin instalar nada.',
      primaryCta: 'Empieza a diseñar gratis',
      secondaryCta: 'Cómo funciona',
      proof: ['Sin instalar nada', '2D y 3D en un mismo flujo', 'Cuenta gratis'],
      appNote: 'Por ahora el editor está en inglés.',
    },
    steps: {
      eyebrow: 'Cómo funciona',
      title: 'Tres pasos, de las medidas al mockup terminado',
      items: [
        { title: '1. Caja', body: 'Elige la estructura, captura ancho, alto y fondo en milímetros o pulgadas y selecciona el material.' },
        { title: '2. Diseño', body: 'Coloca tu arte sobre el suaje extendido, por fuera y por dentro, con guías de corte, doblez y rebase. La vista 3D se actualiza al momento.' },
        { title: '3. Vista previa y descarga', body: 'Arma la caja de extendida a cerrada, gírala en 3D y exporta un mockup en PNG, un video MP4 o el suaje en PDF, SVG o DXF a tamaño real.' },
      ],
      alts: [
        'Panel de caja y tamaño de 3D Box Studio con medidas de ancho, alto y fondo junto a una caja kraft en 3D',
        'Lienzo de diseño de 3D Box Studio con arte colocado sobre el suaje y vista 3D en vivo',
        'Vista previa 3D de una caja impresa y armada, con el control para armarla de extendida a cerrada',
      ],
    },
    features: {
      eyebrow: 'Funciones',
      title: 'Todo lo que necesitas para revisar un empaque antes de imprimir',
      items: [
        { title: 'Medidas exactas', body: 'Ancho, alto y fondo en mm o pulgadas. El suaje 2D y el modelo 3D salen de las mismas medidas.' },
        { title: 'Diseño sobre el suaje', body: 'Sube PNG, JPG, WebP o SVG y colócalos por fuera y por dentro de la caja, en capas que puedes mover, escalar y rotar.' },
        { title: 'Armado en 3D', body: 'Pasa de la caja extendida a la caja cerrada con un solo control y revisa cada cara antes de mandar a imprimir.' },
        { title: 'Materiales', body: 'Cartulina blanca, kraft, soft touch, mate, brillante y foil para ver cómo cambia el acabado.' },
        { title: 'PNG, MP4 y suaje 1:1', body: 'Mockups en PNG y un video MP4 de la caja armándose para tiendas en línea y redes, un PDF del suaje a escala real con rebase, y la plantilla de corte en SVG o DXF.' },
        { title: 'Guarda y comparte', body: 'Tus proyectos se guardan en tu cuenta y puedes mandar un enlace 3D de solo lectura a clientes o a tu equipo.' },
      ],
    },
    faq: {
      eyebrow: 'Preguntas frecuentes',
      title: 'Preguntas frecuentes',
      items: [
        { question: '¿3D Box Studio es gratis?', answer: 'Sí. Es gratis y funciona en el navegador. Para usar el Studio, guardar y exportar necesitas una cuenta gratuita, que puedes crear con Google o con tu correo.' },
        { question: '¿Qué tipos de caja puedo diseñar?', answer: 'Caja plegadiza con cierre invertido, caja con cierre recto, caja de envío con tapa dividida, caja de pizza, caja mailer (FEFCO 0427), caja con funda y caja rígida con tapa y base. Puedes ajustar el tamaño de cada solapa. La caja tipo cajón llegará pronto.' },
        { question: '¿Qué puedo exportar?', answer: 'Mockups en PNG desde la vista 3D, un video MP4 de unos 10 segundos de la caja armándose y girando, el suaje en PDF vectorial a escala 1:1 (cara exterior o interior, con rebase y líneas de corte y doblez) y la plantilla de corte en SVG o DXF.' },
        { question: '¿El suaje está listo para producción?', answer: 'Es una plantilla de corte real a escala 1:1, calculada con tus medidas y el calibre del cartón, útil para pruebas, muestras y cotizaciones. Antes de fabricar, confirma con tu imprenta sus tolerancias y herramental.' },
        { question: '¿Está en español?', answer: 'Esta página sí; el editor está en inglés por ahora, pero es muy visual y funciona en tres pasos: Caja, Diseño y Vista previa.' },
      ],
    },
    closing: { title: 'Tu próximo empaque empieza aquí', body: 'Crea una cuenta gratis, elige una caja, ajusta las medidas y revisa tu diseño en 3D.', cta: 'Empieza a diseñar gratis', note: 'Cuenta gratis · Regístrate con Google o con tu correo' },
    footer: { tagline: 'Ideas de empaque, hechas realidad.', product: 'Producto', company: 'Empresa', studio: 'Studio', guides: 'Guías', faq: 'Preguntas frecuentes', contact: 'Contacto', privacy: 'Privacidad', terms: 'Términos', cookies: 'Configurar cookies' },
  },

  fr: {
    lang: 'fr',
    ogLocale: 'fr_FR',
    nativeName: 'Français',
    title: 'Créateur de boîtes 3D et mockups gratuit | 3D Box Studio',
    description: 'Créateur de boîtes 3D gratuit en ligne : dimensions exactes, design sur le tracé de découpe, pliage en 3D, vidéo MP4 et tracé PDF, SVG ou DXF à l’échelle 1:1. Compte gratuit.',
    nav: { features: 'Fonctionnalités', templates: 'Modèles de boîtes', faq: 'FAQ', guides: 'Guides', openStudio: 'Ouvrir le Studio', languages: 'Langue', skip: 'Aller au contenu', openMenu: 'Ouvrir le menu', closeMenu: 'Fermer le menu' },
    hero: {
      badge: 'Générateur de boîtes 3D et mockups gratuit',
      line1: 'Dessinez la boîte.',
      line2: 'Voyez-la en 3D.',
      intro: '3D Box Studio est un créateur de boîtes 3D gratuit en ligne. Choisissez un modèle de boîte, saisissez les dimensions exactes, placez votre visuel sur le tracé de découpe, pliez la boîte en 3D et exportez un mockup PNG ou un tracé PDF prêt pour l’imprimeur. Un compte gratuit suffit, rien à installer.',
      primaryCta: 'Commencer gratuitement',
      secondaryCta: 'Comment ça marche',
      proof: ['Rien à installer', '2D et 3D dans un seul outil', 'Compte gratuit'],
      appNote: 'L’éditeur est pour l’instant en anglais.',
    },
    steps: {
      eyebrow: 'Comment ça marche',
      title: 'Trois étapes, des dimensions au mockup final',
      items: [
        { title: '1. Boîte', body: 'Choisissez la structure, saisissez largeur, hauteur et profondeur en millimètres ou en pouces, puis la matière.' },
        { title: '2. Design', body: 'Placez vos visuels sur le tracé à plat, à l’extérieur comme à l’intérieur, avec repères de coupe, de rainage et de fond perdu. La 3D se met à jour en direct.' },
        { title: '3. Aperçu et export', body: 'Pliez la boîte d’à plat à fermée, faites-la pivoter en 3D, puis exportez un mockup PNG, une vidéo MP4 ou le tracé en PDF, SVG ou DXF en taille réelle.' },
      ],
      alts: [
        'Panneau Boîte et taille de 3D Box Studio avec largeur, hauteur et profondeur à côté d’une boîte kraft en 3D',
        'Plan de travail de 3D Box Studio avec des visuels placés sur le tracé de découpe et un aperçu 3D en direct',
        'Aperçu 3D d’une boîte imprimée et montée, avec la commande de pliage d’à plat à fermée',
      ],
    },
    features: {
      eyebrow: 'Fonctionnalités',
      title: 'Tout pour valider un emballage avant l’impression',
      items: [
        { title: 'Dimensions exactes', body: 'Largeur, hauteur et profondeur en mm ou en pouces. Le tracé 2D et le modèle 3D partagent les mêmes cotes.' },
        { title: 'Design sur le tracé', body: 'Importez des PNG, JPG, WebP ou SVG et placez-les à l’extérieur et à l’intérieur, en calques à déplacer, redimensionner et pivoter.' },
        { title: 'Pliage en 3D', body: 'Passez de la boîte à plat à la boîte fermée avec un seul curseur et vérifiez chaque face avant l’impression.' },
        { title: 'Matières', body: 'Carton blanc, kraft, soft touch, mat, brillant et dorure pour juger le rendu de la finition.' },
        { title: 'PNG, MP4 et tracé 1:1', body: 'Mockups PNG et vidéo MP4 de la boîte qui se plie pour boutiques en ligne et réseaux sociaux, tracé PDF à l’échelle réelle avec fond perdu, et gabarit de découpe en SVG ou DXF.' },
        { title: 'Enregistrer et partager', body: 'Vos projets sont enregistrés dans votre compte et vous pouvez envoyer un lien 3D en lecture seule à vos clients.' },
      ],
    },
    faq: {
      eyebrow: 'Questions fréquentes',
      title: 'Questions fréquentes',
      items: [
        { question: '3D Box Studio est-il gratuit ?', answer: 'Oui. Il est gratuit et fonctionne dans le navigateur. Un compte gratuit, créé avec Google ou par e-mail, est nécessaire pour utiliser le Studio, enregistrer et exporter.' },
        { question: 'Quels types de boîtes puis-je créer ?', answer: 'Étui à fermeture inversée, étui à fermeture droite, caisse américaine à rabats, boîte à pizza, boîte d’expédition mailer (FEFCO 0427), boîte à fourreau et coffret rigide couvercle et fond. La taille de chaque rabat est réglable. La boîte tiroir arrive bientôt.' },
        { question: 'Que puis-je exporter ?', answer: 'Des mockups PNG depuis la vue 3D, une vidéo MP4 d’environ 10 secondes de la boîte qui se plie et tourne, un tracé de découpe PDF vectoriel à l’échelle 1:1 (face extérieure ou intérieure, avec fond perdu et traits de coupe et de rainage) et le gabarit de découpe en SVG ou DXF.' },
        { question: 'Le tracé est-il prêt pour la production ?', answer: 'C’est un vrai gabarit de découpe à l’échelle 1:1, calculé à partir de vos dimensions et de l’épaisseur du carton, utile pour les épreuves, les échantillons et les devis. Avant fabrication, faites valider les tolérances et l’outillage par votre imprimeur.' },
        { question: 'Le site est-il en français ?', answer: 'Cette page oui ; l’éditeur est pour l’instant en anglais, mais il est très visuel et suit trois étapes : Boîte, Design et Aperçu.' },
      ],
    },
    closing: { title: 'Votre prochain emballage commence ici', body: 'Créez un compte gratuit, choisissez une boîte, réglez les dimensions et vérifiez votre design en 3D.', cta: 'Commencer gratuitement', note: 'Compte gratuit · Inscription avec Google ou par e-mail' },
    footer: { tagline: 'Des idées d’emballage, rendues concrètes.', product: 'Produit', company: 'Entreprise', studio: 'Studio', guides: 'Guides', faq: 'FAQ', contact: 'Contact', privacy: 'Confidentialité', terms: 'Conditions', cookies: 'Paramètres des cookies' },
  },

  'pt-br': {
    lang: 'pt-BR',
    ogLocale: 'pt_BR',
    nativeName: 'Português (Brasil)',
    title: 'Criador de caixas 3D e mockups grátis | 3D Box Studio',
    description: 'Crie caixas em 3D grátis online: medidas exatas, arte sobre a faca de corte, montagem em 3D, vídeo MP4 e faca em PDF, SVG ou DXF na escala 1:1. Conta gratuita.',
    nav: { features: 'Recursos', templates: 'Modelos de caixa', faq: 'Perguntas', guides: 'Guias', openStudio: 'Abrir o Studio', languages: 'Idioma', skip: 'Pular para o conteúdo', openMenu: 'Abrir menu', closeMenu: 'Fechar menu' },
    hero: {
      badge: 'Gerador de caixas 3D e mockups grátis',
      line1: 'Crie a caixa.',
      line2: 'Veja em 3D.',
      intro: 'O 3D Box Studio é um criador de caixas 3D online e gratuito. Escolha um modelo de caixa, informe as medidas exatas, posicione a arte sobre a faca, monte a caixa em 3D e exporte um mockup em PNG ou a faca em PDF pronta para a gráfica. Você só precisa de uma conta gratuita, sem instalar nada.',
      primaryCta: 'Começar a criar grátis',
      secondaryCta: 'Como funciona',
      proof: ['Sem instalação', '2D e 3D no mesmo fluxo', 'Conta gratuita'],
      appNote: 'Por enquanto, o editor está em inglês.',
    },
    steps: {
      eyebrow: 'Como funciona',
      title: 'Três passos, das medidas ao mockup pronto',
      items: [
        { title: '1. Caixa', body: 'Escolha a estrutura, informe largura, altura e profundidade em milímetros ou polegadas e selecione o material.' },
        { title: '2. Arte', body: 'Posicione suas imagens sobre a faca aberta, por fora e por dentro, com guias de corte, vinco e sangria. A visualização 3D se atualiza na hora.' },
        { title: '3. Visualizar e baixar', body: 'Monte a caixa de aberta a fechada, gire em 3D e exporte um mockup em PNG, um vídeo MP4 ou a faca em PDF, SVG ou DXF em tamanho real.' },
      ],
      alts: [
        'Painel Caixa e tamanho do 3D Box Studio com largura, altura e profundidade ao lado de uma caixa kraft em 3D',
        'Área de criação do 3D Box Studio com artes posicionadas sobre a faca de corte e visualização 3D ao vivo',
        'Visualização 3D de uma caixa impressa e montada, com o controle de montagem de aberta a fechada',
      ],
    },
    features: {
      eyebrow: 'Recursos',
      title: 'Tudo o que você precisa para aprovar uma embalagem antes de imprimir',
      items: [
        { title: 'Medidas exatas', body: 'Largura, altura e profundidade em mm ou polegadas. A faca 2D e o modelo 3D usam as mesmas medidas.' },
        { title: 'Arte sobre a faca', body: 'Envie PNG, JPG, WebP ou SVG e posicione por fora e por dentro da caixa, em camadas que você move, redimensiona e gira.' },
        { title: 'Montagem em 3D', body: 'Passe da caixa aberta para a fechada com um único controle e confira cada face antes de imprimir.' },
        { title: 'Materiais', body: 'Papel cartão branco, kraft, soft touch, fosco, brilho e hot stamping para ver como o acabamento muda.' },
        { title: 'PNG, MP4 e faca 1:1', body: 'Mockups em PNG e um vídeo MP4 da caixa se montando para lojas virtuais e redes sociais, a faca em PDF na escala real com sangria, e o gabarito de corte em SVG ou DXF.' },
        { title: 'Salve e compartilhe', body: 'Seus projetos ficam salvos na sua conta e você pode enviar um link 3D somente leitura para clientes ou para a equipe.' },
      ],
    },
    faq: {
      eyebrow: 'Perguntas frequentes',
      title: 'Perguntas frequentes',
      items: [
        { question: 'O 3D Box Studio é grátis?', answer: 'Sim. É gratuito e funciona no navegador. Para usar o Studio, salvar e exportar, você precisa de uma conta gratuita, criada com Google ou e-mail.' },
        { question: 'Quais tipos de caixa posso criar?', answer: 'Cartucho com abas invertidas, cartucho com fechamento reto, caixa de papelão com abas divididas, caixa de pizza, caixa mailer (FEFCO 0427), caixa com luva e caixa rígida com tampa e fundo. Dá para ajustar o tamanho de cada aba. A caixa gaveta chega em breve.' },
        { question: 'O que posso exportar?', answer: 'Mockups em PNG a partir da visualização 3D, um vídeo MP4 de cerca de 10 segundos da caixa se montando e girando, a faca de corte em PDF vetorial na escala 1:1 (face externa ou interna, com sangria e linhas de corte e vinco) e o gabarito de corte em SVG ou DXF.' },
        { question: 'A faca está pronta para produção?', answer: 'É um gabarito de corte real na escala 1:1, calculado a partir das suas medidas e da espessura do papelão, útil para provas, amostras e orçamentos. Antes de produzir, confirme com sua gráfica as tolerâncias e o ferramental.' },
        { question: 'O site está em português?', answer: 'Esta página sim; o editor está em inglês por enquanto, mas é bem visual e segue três passos: Caixa, Arte e Visualização.' },
      ],
    },
    closing: { title: 'Sua próxima embalagem começa aqui', body: 'Crie uma conta gratuita, escolha uma caixa, ajuste as medidas e confira o design em 3D.', cta: 'Começar a criar grátis', note: 'Conta gratuita · Cadastre-se com Google ou e-mail' },
    footer: { tagline: 'Ideias de embalagem, que ganham forma.', product: 'Produto', company: 'Empresa', studio: 'Studio', guides: 'Guias', faq: 'Perguntas frequentes', contact: 'Contato', privacy: 'Privacidade', terms: 'Termos', cookies: 'Configurações de cookies' },
  },

  de: {
    lang: 'de',
    ogLocale: 'de_DE',
    nativeName: 'Deutsch',
    title: 'Kostenloser 3D-Box-Generator & Mockups | 3D Box Studio',
    description: 'Kostenloser 3D-Box-Generator im Browser: exakte Maße, Gestaltung auf der Stanzkontur, Faltung in 3D, MP4-Video und Stanzkontur als PDF, SVG oder DXF im Maßstab 1:1. Kostenloses Konto.',
    nav: { features: 'Funktionen', templates: 'Schachtelvorlagen', faq: 'FAQ', guides: 'Ratgeber', openStudio: 'Studio öffnen', languages: 'Sprache', skip: 'Zum Inhalt springen', openMenu: 'Menü öffnen', closeMenu: 'Menü schließen' },
    hero: {
      badge: 'Kostenloser 3D-Box-Generator und Mockup-Tool',
      line1: 'Gestalte die Box.',
      line2: 'Sieh sie in 3D.',
      intro: '3D Box Studio ist ein kostenloser Online-Box-Designer. Wähle eine Schachtelform, gib die genauen Maße ein, platziere dein Design auf der Stanzkontur, falte die Box in 3D und exportiere ein PNG-Mockup oder eine druckfertige PDF-Stanzkontur. Du brauchst nur ein kostenloses Konto – ohne Installation.',
      primaryCta: 'Kostenlos loslegen',
      secondaryCta: 'So funktioniert es',
      proof: ['Ohne Installation', '2D und 3D in einem Ablauf', 'Kostenloses Konto'],
      appNote: 'Der Editor ist derzeit auf Englisch.',
    },
    steps: {
      eyebrow: 'So funktioniert es',
      title: 'Drei Schritte von den Maßen zum fertigen Mockup',
      items: [
        { title: '1. Box', body: 'Wähle die Konstruktion, gib Breite, Höhe und Tiefe in Millimetern oder Zoll ein und wähle das Material.' },
        { title: '2. Design', body: 'Platziere deine Motive auf der flachen Stanzkontur, außen und innen, mit Schnitt-, Rill- und Beschnitthilfslinien. Die 3D-Ansicht aktualisiert sich sofort.' },
        { title: '3. Vorschau & Download', body: 'Falte die Box von flach bis geschlossen, drehe sie in 3D und exportiere ein PNG-Mockup, ein MP4-Video oder die Stanzkontur als PDF, SVG oder DXF in Originalgröße.' },
      ],
      alts: [
        'Box-und-Größe-Bereich von 3D Box Studio mit Breite, Höhe und Tiefe neben einer Kraft-Schachtel in 3D',
        'Design-Arbeitsfläche von 3D Box Studio mit Motiven auf der Stanzkontur und Live-3D-Vorschau',
        '3D-Vorschau einer bedruckten, geschlossenen Schachtel mit dem Regler von flach bis geschlossen',
      ],
    },
    features: {
      eyebrow: 'Funktionen',
      title: 'Alles, um eine Verpackung vor dem Druck zu prüfen',
      items: [
        { title: 'Exakte Maße', body: 'Breite, Höhe und Tiefe in mm oder Zoll. Stanzkontur und 3D-Modell basieren auf denselben Maßen.' },
        { title: 'Design auf der Stanzkontur', body: 'Lade PNG, JPG, WebP oder SVG hoch und platziere sie außen und innen als Ebenen, die du verschieben, skalieren und drehen kannst.' },
        { title: 'Faltung in 3D', body: 'Mit einem Regler von der flachen zur geschlossenen Box – und jede Seite vor dem Druck prüfen.' },
        { title: 'Materialien', body: 'Weißer Karton, Kraft, Soft-Touch, matt, glänzend und Folienprägung, um die Wirkung der Veredelung zu sehen.' },
        { title: 'PNG, MP4 und Stanzkontur 1:1', body: 'PNG-Mockups und ein MP4-Video der sich faltenden Box für Onlineshops und Social Media, eine PDF-Stanzkontur in Originalgröße mit Beschnitt und die Schneidvorlage als SVG oder DXF.' },
        { title: 'Speichern & teilen', body: 'Projekte werden in deinem Konto gespeichert, und du kannst Kunden einen 3D-Link zum Ansehen schicken.' },
      ],
    },
    faq: {
      eyebrow: 'Häufige Fragen',
      title: 'Häufige Fragen',
      items: [
        { question: 'Ist 3D Box Studio kostenlos?', answer: 'Ja. Es ist kostenlos und läuft im Browser. Zum Gestalten, Speichern und Exportieren brauchst du ein kostenloses Konto, das du mit Google oder per E-Mail erstellst.' },
        { question: 'Welche Schachteltypen kann ich gestalten?', answer: 'Faltschachtel mit gegenläufigem Steckverschluss, Faltschachtel mit gleichläufigem Steckverschluss, Versandkarton mit geteiltem Deckel, Pizzakarton, Mailerbox (FEFCO 0427), Schiebeschachtel mit Hülse und feste Stülpdeckelschachtel. Jede Lasche ist in der Größe einstellbar. Die Schubladenbox folgt bald.' },
        { question: 'Was kann ich exportieren?', answer: 'PNG-Mockups aus der 3D-Ansicht, ein etwa 10 Sekunden langes MP4-Video der sich faltenden und drehenden Box, eine vektorielle PDF-Stanzkontur im Maßstab 1:1 (Außen- oder Innenseite, mit Beschnitt sowie Schneid- und Rilllinien) und die Schneidvorlage als SVG oder DXF.' },
        { question: 'Ist die Stanzkontur produktionsreif?', answer: 'Sie ist eine echte Schneidvorlage im Maßstab 1:1, berechnet aus deinen Maßen und der Kartonstärke, und eignet sich für Proofs, Muster und Angebote. Kläre vor der Produktion Toleranzen und Werkzeuge mit deiner Druckerei.' },
        { question: 'Gibt es die Seite auf Deutsch?', answer: 'Diese Seite ja; der Editor ist derzeit auf Englisch, aber sehr visuell und folgt drei Schritten: Box, Design und Vorschau.' },
      ],
    },
    closing: { title: 'Deine nächste Verpackung beginnt hier', body: 'Erstelle ein kostenloses Konto, wähle eine Box, stelle die Maße ein und prüfe dein Design in 3D.', cta: 'Kostenlos loslegen', note: 'Kostenloses Konto · Anmeldung mit Google oder E-Mail' },
    footer: { tagline: 'Verpackungsideen, greifbar gemacht.', product: 'Produkt', company: 'Unternehmen', studio: 'Studio', guides: 'Ratgeber', faq: 'FAQ', contact: 'Kontakt', privacy: 'Datenschutz', terms: 'AGB', cookies: 'Cookie-Einstellungen' },
  },

  zh: {
    lang: 'zh-Hans',
    ogLocale: 'zh_CN',
    nativeName: '简体中文',
    title: '免费 3D 包装盒设计与效果图生成器 | 3D Box Studio',
    description: '免费在线 3D 包装盒生成器：输入精确尺寸，在刀版图上排版，实时 3D 折叠预览，导出 PNG 效果图、MP4 视频，以及 1:1 的 PDF、SVG 或 DXF 刀版图。需注册免费账户。',
    nav: { features: '功能', templates: '盒型模板', faq: '常见问题', guides: '指南', openStudio: '打开 Studio', languages: '语言', skip: '跳到正文', openMenu: '打开菜单', closeMenu: '关闭菜单' },
    hero: {
      badge: '免费 3D 包装盒生成器与效果图工具',
      line1: '设计包装盒，',
      line2: '立即看 3D。',
      intro: '3D Box Studio 是一款免费的在线 3D 包装盒设计工具。选择盒型，输入精确尺寸，把设计稿放到刀版图上，在 3D 中折叠成盒，再导出 PNG 效果图或可交给印刷厂的 PDF 刀版图。只需注册免费账户，无需安装任何软件。',
      primaryCta: '免费开始设计',
      secondaryCta: '了解使用流程',
      proof: ['无需安装', '2D 与 3D 一体化', '免费账户'],
      appNote: '目前编辑器界面为英文。',
    },
    steps: {
      eyebrow: '使用流程',
      title: '三步完成：从尺寸到成品效果图',
      items: [
        { title: '1. 盒型', body: '选择盒型结构，以毫米或英寸输入长、宽、高，并选择材质。' },
        { title: '2. 设计', body: '在展开的刀版图内外两面摆放图片，带有裁切线、压痕线和出血参考线，3D 预览实时同步。' },
        { title: '3. 预览与下载', body: '将盒子从展开折叠到闭合，360° 旋转查看，然后导出 PNG 效果图、MP4 视频，或 1:1 的 PDF、SVG、DXF 刀版图。' },
      ],
      alts: [
        '3D Box Studio 盒型与尺寸面板，旁边是一个牛皮纸 3D 盒子',
        '3D Box Studio 设计画布：图片摆放在刀版图上，并显示实时 3D 预览',
        '印刷完成并组装好的盒子 3D 预览，带有从展开到闭合的折叠控制',
      ],
    },
    features: {
      eyebrow: '功能',
      title: '印刷前审核包装所需的一切',
      items: [
        { title: '精确尺寸', body: '支持毫米或英寸输入长、宽、高，2D 刀版图与 3D 模型使用同一组尺寸。' },
        { title: '在刀版图上设计', body: '上传 PNG、JPG、WebP 或 SVG，放置在盒子内外两面，图层可移动、缩放和旋转。' },
        { title: '3D 折叠预览', body: '一个滑块即可从展开状态折叠到闭合，印刷前逐面检查。' },
        { title: '材质', body: '白卡、牛皮纸、触感膜、哑光、亮光和烫金，直观对比不同工艺效果。' },
        { title: 'PNG、MP4 与 1:1 刀版', body: '导出用于电商详情页和社交媒体的 PNG 效果图与盒子折叠的 MP4 视频，带出血的原尺寸 PDF 刀版图，以及 SVG 或 DXF 格式的切割模板。' },
        { title: '保存与分享', body: '项目保存在你的账户中，还可以发送只读的 3D 预览链接给客户或同事。' },
      ],
    },
    faq: {
      eyebrow: '常见问题',
      title: '常见问题',
      items: [
        { question: '3D Box Studio 免费吗？', answer: '免费，并且直接在浏览器中使用。使用 Studio、保存和导出需要注册免费账户，可用 Google 或邮箱注册。' },
        { question: '可以设计哪些盒型？', answer: '反向插舌折叠纸盒、同向插舌折叠纸盒、对开盖瓦楞纸箱、披萨盒、飞机盒（FEFCO 0427）、套盒，以及天地盖礼盒。每个折翼的尺寸都可以单独调整。抽屉盒即将推出。' },
        { question: '可以导出哪些文件？', answer: '可从 3D 视图导出 PNG 效果图，导出约 10 秒的盒子折叠并旋转的 MP4 视频，导出 1:1 矢量 PDF 刀版图（外侧或内侧，含出血、裁切线和压痕线），以及 SVG 或 DXF 格式的切割模板。' },
        { question: '刀版图可以直接用于生产吗？', answer: '这是根据你的尺寸和纸板厚度生成的 1:1 真实刀版，适用于打样、样品和报价。正式生产前，请与印刷厂确认公差和刀模工艺。' },
        { question: '有中文界面吗？', answer: '本页面为中文；编辑器目前为英文，但操作直观，按“盒型、设计、预览”三步完成。' },
      ],
    },
    closing: { title: '从这里开始你的下一个包装', body: '注册免费账户，选择盒型，调整尺寸，在 3D 中检查你的设计。', cta: '免费开始设计', note: '免费账户 · 可用 Google 或邮箱注册' },
    footer: { tagline: '让包装创意触手可及。', product: '产品', company: '公司', studio: 'Studio', guides: '指南', faq: '常见问题', contact: '联系我们', privacy: '隐私政策', terms: '服务条款', cookies: 'Cookie 设置' },
  },
};

export function isLocalizedHomeLocale(value: string): value is LocalizedHomeLocale {
  return (localizedHomeLocales as readonly string[]).includes(value);
}

/** hreflang map for the home page group, shared by metadata and the sitemap. */
export const homeLanguageAlternates: Record<string, string> = {
  en: '/',
  ...Object.fromEntries(localizedHomeLocales.map(locale => [localizedHome[locale].lang, `/${locale}`])),
  'x-default': '/',
};
