export const migratedLocales = ['fr','es','de','zh'] as const;
export type MigratedLocale = (typeof migratedLocales)[number];

export const localeMeta: Record<MigratedLocale, { lang:string; homeTitle:string; homeDescription:string; studioTitle:string; studioDescription:string }> = {
  fr: {
    lang:'fr',
    homeTitle:'Créateur de boîtes 3D gratuit et générateur de mockups packaging | 3D Box Studio',
    homeDescription:'Créateur de boîtes 3D en ligne gratuit et générateur de mockups d’emballage. Concevez cartons et mailers dans le navigateur : dimensions personnalisées, matériaux PBR, ouvertures de couvercle, artwork par face, sauvegarde cloud, liens de prévisualisation, export PNG et JSON.',
    studioTitle:'Créateur de boîtes 3D en ligne gratuit — Cartons & mailers | 3D Box Studio',
    studioDescription:'Ouvrez le studio gratuit de boîtes 3D dans votre navigateur. Concevez dimensions, matériaux, ouvertures et artwork par face, puis sauvegardez, partagez et exportez vos mockups.'
  },
  es: {
    lang:'es',
    homeTitle:'Diseñador de cajas 3D gratis y generador de mockups de packaging | 3D Box Studio',
    homeDescription:'Diseñador de cajas 3D online gratis y generador de mockups de packaging. Crea estuches y mailers en el navegador: dimensiones a medida, materiales PBR, apertura de tapa y arte por cara, guardado, enlaces de vista previa y exportación.',
    studioTitle:'Creador de cajas 3D online gratis — Diseña estuches y mailers | 3D Box Studio',
    studioDescription:'Abre el estudio gratis de cajas 3D en el navegador. Diseña dimensiones, materiales, aperturas y arte por cara; guarda, comparte y exporta mockups.'
  },
  de: {
    lang:'de',
    homeTitle:'Kostenloser 3D-Schachtel-Designer & Verpackungs-Mockup-Generator | 3D Box Studio',
    homeDescription:'Kostenloser Online-3D-Schachtel-Designer und Verpackungs-Mockup-Generator. Faltschachteln und Mailer im Browser erstellen — individuelle Maße, PBR-Materialien, Deckel- und Klappenöffnung, Artwork je Seite, Cloud-Speicher und Export.',
    studioTitle:'Kostenloser 3D-Box-Maker online — Kartons & Mailer gestalten | 3D Box Studio',
    studioDescription:'Öffnen Sie den kostenlosen 3D-Box-Maker im Browser. Gestalten Sie Maße, Materialien, Öffnungen und Artwork je Seite; speichern, teilen und exportieren Sie Mockups.'
  },
  zh: {
    lang:'zh',
    homeTitle:'免费 3D 纸盒设计器与包装效果图生成器 | 3D Box Studio',
    homeDescription:'免费在线 3D 纸盒设计与包装效果图工具。在浏览器中创建折叠纸盒与邮寄盒：自定义尺寸、PBR 材质、开盖动画、单面贴图、云端保存、预览链接以及 PNG 和 JSON 导出。',
    studioTitle:'免费在线 3D 纸盒制作工具 — 设计纸盒与邮寄盒 | 3D Box Studio',
    studioDescription:'在浏览器中打开免费 3D 纸盒工作室，设计尺寸、材质、开合与单面贴图；保存、分享并导出包装效果图。'
  }
};

export function isMigratedLocale(value:string): value is MigratedLocale {
  return (migratedLocales as readonly string[]).includes(value);
}
