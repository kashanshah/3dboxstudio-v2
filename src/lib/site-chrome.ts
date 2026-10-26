// The words and links of the site header and footer, in every language the
// site has pages in. One header and one footer serve every marketing page
// (components/site-shell.tsx); only their language changes. The Studio,
// guides and company pages are English-only, so translated pages link to
// them with hrefLang="en". Kept apart from the translated home pages'
// content so the header stays small: it ships with every page.

export const CHROME_LANGUAGE_CODES = ['en', 'es', 'es-mx', 'fr', 'pt-br', 'de', 'zh'] as const;
export type ChromeLanguage = (typeof CHROME_LANGUAGE_CODES)[number];
export type ChromeLink = { href: string; label: string; hrefLang?: string; native?: boolean };
/** A header item: a link, or a menu of links. */
export type ChromeNavItem = ChromeLink | { label: string; children: ChromeLink[] };
/** The same page in other languages, by language; the switcher falls back to each language's home page. */
export type ChromeAlternates = Partial<Record<ChromeLanguage, string>>;

type Words = {
  /** BCP 47 tag, own name, and the short label on the switcher. */
  lang: string; name: string; short: string;
  skip: string; homeLabel: string; mainNav: string; openMenu: string; closeMenu: string; openStudio: string; languages: string;
  features: string; templates: string; faq: string; guides: string; contact: string;
  product: string; studio: string; whatsNew: string; help: string;
  tools: string; mockupGenerator: string; dielineGenerator: string; packagingDesign: string; boxSizes: string;
  compare: string; alternative: (name: string) => string;
  company: string; privacy: string; terms: string; cookies: string;
  tagline: string; base: string;
};

const WORDS: Record<ChromeLanguage, Words> = {
  en: {
    lang: 'en', name: 'English', short: 'EN',
    skip: 'Skip to content', homeLabel: '3D Box Studio home', mainNav: 'Main navigation', openMenu: 'Open menu', closeMenu: 'Close menu', openStudio: 'Open Studio', languages: 'Language',
    features: 'Features', templates: 'Box templates', faq: 'FAQ', guides: 'Guides', contact: 'Contact',
    product: 'Product', studio: 'Studio', whatsNew: 'What’s new', help: 'Help center',
    tools: 'Tools', mockupGenerator: '3D box mockup generator', dielineGenerator: 'Box dieline generator', packagingDesign: 'Packaging design online', boxSizes: 'Standard box sizes',
    compare: 'Compare', alternative: name => `${name} alternative`,
    company: 'Company', privacy: 'Privacy', terms: 'Terms', cookies: 'Cookie settings',
    tagline: 'Packaging ideas, made tangible.', base: 'Built for thoughtful packaging work.',
  },
  es: {
    lang: 'es', name: 'Español (España)', short: 'ES',
    skip: 'Saltar al contenido', homeLabel: 'Inicio de 3D Box Studio', mainNav: 'Navegación principal', openMenu: 'Abrir menú', closeMenu: 'Cerrar menú', openStudio: 'Abrir Studio', languages: 'Idioma',
    features: 'Funciones', templates: 'Plantillas de cajas', faq: 'Preguntas', guides: 'Guías', contact: 'Contacto',
    product: 'Producto', studio: 'Studio', whatsNew: 'Novedades', help: 'Centro de ayuda',
    tools: 'Herramientas', mockupGenerator: 'Generador de mockups 3D', dielineGenerator: 'Generador de troqueles', packagingDesign: 'Diseño de packaging online', boxSizes: 'Medidas estándar de cajas',
    compare: 'Comparar', alternative: name => `Alternativa a ${name}`,
    company: 'Empresa', privacy: 'Privacidad', terms: 'Condiciones', cookies: 'Configurar cookies',
    tagline: 'Ideas de packaging, hechas tangibles.', base: 'Hecho para trabajos de packaging cuidados.',
  },
  'es-mx': {
    lang: 'es-MX', name: 'Español (México)', short: 'ES-MX',
    skip: 'Ir al contenido', homeLabel: 'Inicio de 3D Box Studio', mainNav: 'Navegación principal', openMenu: 'Abrir menú', closeMenu: 'Cerrar menú', openStudio: 'Abrir Studio', languages: 'Idioma',
    features: 'Funciones', templates: 'Plantillas de cajas', faq: 'Preguntas', guides: 'Guías', contact: 'Contacto',
    product: 'Producto', studio: 'Studio', whatsNew: 'Novedades', help: 'Centro de ayuda',
    tools: 'Herramientas', mockupGenerator: 'Generador de mockups 3D', dielineGenerator: 'Generador de troqueles', packagingDesign: 'Diseño de empaques en línea', boxSizes: 'Medidas estándar de cajas',
    compare: 'Comparar', alternative: name => `Alternativa a ${name}`,
    company: 'Empresa', privacy: 'Privacidad', terms: 'Términos', cookies: 'Configurar cookies',
    tagline: 'Ideas de empaque, hechas realidad.', base: 'Hecho para proyectos de empaque cuidados.',
  },
  fr: {
    lang: 'fr', name: 'Français', short: 'FR',
    skip: 'Aller au contenu', homeLabel: 'Accueil 3D Box Studio', mainNav: 'Navigation principale', openMenu: 'Ouvrir le menu', closeMenu: 'Fermer le menu', openStudio: 'Ouvrir le Studio', languages: 'Langue',
    features: 'Fonctionnalités', templates: 'Modèles de boîtes', faq: 'FAQ', guides: 'Guides', contact: 'Contact',
    product: 'Produit', studio: 'Studio', whatsNew: 'Nouveautés', help: 'Centre d’aide',
    tools: 'Outils', mockupGenerator: 'Générateur de mockups 3D', dielineGenerator: 'Générateur de gabarits de découpe', packagingDesign: 'Design d’emballage en ligne', boxSizes: 'Tailles de boîtes standard',
    compare: 'Comparer', alternative: name => `Alternative à ${name}`,
    company: 'Entreprise', privacy: 'Confidentialité', terms: 'Conditions', cookies: 'Paramètres des cookies',
    tagline: 'Des idées d’emballage, rendues concrètes.', base: 'Conçu pour un travail d’emballage soigné.',
  },
  'pt-br': {
    lang: 'pt-BR', name: 'Português (Brasil)', short: 'PT',
    skip: 'Pular para o conteúdo', homeLabel: 'Início do 3D Box Studio', mainNav: 'Navegação principal', openMenu: 'Abrir menu', closeMenu: 'Fechar menu', openStudio: 'Abrir o Studio', languages: 'Idioma',
    features: 'Recursos', templates: 'Modelos de caixa', faq: 'Perguntas', guides: 'Guias', contact: 'Contato',
    product: 'Produto', studio: 'Studio', whatsNew: 'Novidades', help: 'Central de ajuda',
    tools: 'Ferramentas', mockupGenerator: 'Gerador de mockups 3D', dielineGenerator: 'Gerador de faca de corte', packagingDesign: 'Design de embalagens online', boxSizes: 'Tamanhos padrão de caixas',
    compare: 'Comparar', alternative: name => `Alternativa ao ${name}`,
    company: 'Empresa', privacy: 'Privacidade', terms: 'Termos', cookies: 'Configurações de cookies',
    tagline: 'Ideias de embalagem, que ganham forma.', base: 'Feito para um trabalho de embalagem cuidadoso.',
  },
  de: {
    lang: 'de', name: 'Deutsch', short: 'DE',
    skip: 'Zum Inhalt springen', homeLabel: '3D Box Studio Startseite', mainNav: 'Hauptnavigation', openMenu: 'Menü öffnen', closeMenu: 'Menü schließen', openStudio: 'Studio öffnen', languages: 'Sprache',
    features: 'Funktionen', templates: 'Schachtelvorlagen', faq: 'FAQ', guides: 'Ratgeber', contact: 'Kontakt',
    product: 'Produkt', studio: 'Studio', whatsNew: 'Neuigkeiten', help: 'Hilfe',
    tools: 'Werkzeuge', mockupGenerator: '3D-Schachtel-Mockup-Generator', dielineGenerator: 'Stanzkontur-Generator', packagingDesign: 'Verpackungsdesign online', boxSizes: 'Standard-Kartongrößen',
    compare: 'Vergleichen', alternative: name => `${name}-Alternative`,
    company: 'Unternehmen', privacy: 'Datenschutz', terms: 'AGB', cookies: 'Cookie-Einstellungen',
    tagline: 'Verpackungsideen, greifbar gemacht.', base: 'Gemacht für sorgfältige Verpackungsarbeit.',
  },
  zh: {
    lang: 'zh-Hans', name: '简体中文', short: '中文',
    skip: '跳到正文', homeLabel: '3D Box Studio 首页', mainNav: '主导航', openMenu: '打开菜单', closeMenu: '关闭菜单', openStudio: '打开 Studio', languages: '语言',
    features: '功能', templates: '盒型模板', faq: '常见问题', guides: '指南', contact: '联系我们',
    product: '产品', studio: 'Studio', whatsNew: '更新日志', help: '帮助中心',
    tools: '工具', mockupGenerator: '3D 盒子样机生成器', dielineGenerator: '刀版图生成器', packagingDesign: '在线包装设计', boxSizes: '标准纸箱尺寸',
    compare: '对比', alternative: name => `${name} 替代方案`,
    company: '公司', privacy: '隐私政策', terms: '服务条款', cookies: 'Cookie 设置',
    tagline: '让包装创意触手可及。', base: '为用心的包装设计而生。',
  },
};

const isSpanish = (language: ChromeLanguage) => language === 'es' || language === 'es-mx';
/** Spanish has its own template pages and generator; other languages link to the English ones. */
export const templatesHref = (language: ChromeLanguage) => isSpanish(language) ? '/es/box-templates' : '/box-templates';
export const generatorHref = (language: ChromeLanguage) => isSpanish(language) ? '/es/box-dieline-generator' : '/box-dieline-generator';
export const homeHref = (language: ChromeLanguage) => language === 'en' ? '/' : `/${language}`;

export function chromeWords(language: ChromeLanguage = 'en') {
  return WORDS[language];
}

/**
 * The header: the same four items in every language. Features and Tools
 * open menus; Contact lives in the footer. Translated pages point Features
 * and FAQ at their own home page's sections.
 */
export function navItems(language: ChromeLanguage = 'en'): ChromeNavItem[] {
  const w = WORDS[language];
  const en = language === 'en' ? undefined : 'en';
  const own = isSpanish(language) ? 'es' : en;
  const tools = { label: w.tools, children: [
    { href: templatesHref(language), label: w.templates, hrefLang: own },
    { href: generatorHref(language), label: w.dielineGenerator, hrefLang: own },
    { href: '/3d-box-mockup-generator', label: w.mockupGenerator, hrefLang: en },
    { href: '/box-sizes', label: w.boxSizes, hrefLang: en },
  ] };
  if (language === 'en') return [
    { label: w.features, children: [
      { href: '/features', label: 'All features' },
      { href: '/#showcase', label: 'Examples', native: true },
      { href: '/#workflow', label: 'Workflow', native: true },
      { href: '/changelog', label: w.whatsNew },
    ] },
    tools,
    { href: '/blog', label: w.guides },
    { href: '/faq', label: w.faq },
  ];
  return [
    { href: `/${language}#features`, label: w.features, native: true },
    tools,
    { href: '/blog', label: w.guides, hrefLang: 'en' },
    { href: `/${language}#faq`, label: w.faq, native: true },
  ];
}

/** The header items as plain links, for the phone menu. */
export function flatNavLinks(language: ChromeLanguage = 'en'): ChromeLink[] {
  return navItems(language).flatMap(item => 'children' in item ? item.children : [item]);
}

export function footerColumns(language: ChromeLanguage = 'en'): { title: string; links: ChromeLink[] }[] {
  const w = WORDS[language];
  const en = language === 'en' ? undefined : 'en';
  const own = isSpanish(language) ? 'es' : en;
  return [
    { title: w.product, links: [
      { href: '/studio', label: w.studio },
      { href: '/changelog', label: w.whatsNew, hrefLang: en },
      { href: '/blog', label: w.guides, hrefLang: en },
      { href: '/faq', label: w.help, hrefLang: en },
    ] },
    { title: w.tools, links: [
      { href: '/3d-box-mockup-generator', label: w.mockupGenerator, hrefLang: en },
      { href: generatorHref(language), label: w.dielineGenerator, hrefLang: own },
      { href: templatesHref(language), label: w.templates, hrefLang: own },
      { href: '/packaging-design-online', label: w.packagingDesign, hrefLang: en },
      { href: '/box-sizes', label: w.boxSizes, hrefLang: en },
    ] },
    { title: w.compare, links: [
      { href: '/pacdora-alternative', label: w.alternative('Pacdora'), hrefLang: en },
      { href: '/boxshot-alternative', label: w.alternative('Boxshot'), hrefLang: en },
      { href: '/adobe-dimension-alternative', label: w.alternative('Adobe Dimension'), hrefLang: en },
      { href: '/placeit-box-mockup-alternative', label: w.alternative('Placeit'), hrefLang: en },
    ] },
    { title: w.company, links: [
      { href: '/contact', label: w.contact, hrefLang: en },
      { href: '/privacy', label: w.privacy, hrefLang: en },
      { href: '/terms', label: w.terms, hrefLang: en },
    ] },
  ];
}

/** Every language, for the switcher and the footer: the same page in it when there is one, else its home page. */
export function languageLinks(alternates: ChromeAlternates = {}) {
  return CHROME_LANGUAGE_CODES.map(code => ({ code, lang: WORDS[code].lang, name: WORDS[code].name, short: WORDS[code].short, href: alternates[code] ?? homeHref(code) }));
}
