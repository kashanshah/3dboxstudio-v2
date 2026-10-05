// Locale prefixes that existed in V1. Their /studio, /blog, /faq, … URLs redirect
// to the English pages; the translated home pages live in content/localized-home.
export const migratedLocales = ['fr','es','de','zh'] as const;
export type MigratedLocale = (typeof migratedLocales)[number];

export const localeMeta: Record<MigratedLocale, { lang:string; studioTitle:string; studioDescription:string }> = {
  fr: {
    lang:'fr',
    studioTitle:'Créateur de boîtes 3D en ligne gratuit — Cartons & mailers | 3D Box Studio',
    studioDescription:'Ouvrez le studio gratuit de boîtes 3D dans votre navigateur. Concevez dimensions, matériaux, ouvertures et artwork par face, puis sauvegardez, partagez et exportez vos mockups.'
  },
  es: {
    lang:'es',
    studioTitle:'Creador de cajas 3D online gratis — Diseña estuches y mailers | 3D Box Studio',
    studioDescription:'Abre el estudio gratis de cajas 3D en el navegador. Diseña dimensiones, materiales, aperturas y arte por cara; guarda, comparte y exporta mockups.'
  },
  de: {
    lang:'de',
    studioTitle:'Kostenloser 3D-Box-Maker online — Kartons & Mailer gestalten | 3D Box Studio',
    studioDescription:'Öffnen Sie den kostenlosen 3D-Box-Maker im Browser. Gestalten Sie Maße, Materialien, Öffnungen und Artwork je Seite; speichern, teilen und exportieren Sie Mockups.'
  },
  zh: {
    lang:'zh',
    studioTitle:'免费在线 3D 纸盒制作工具 — 设计纸盒与邮寄盒 | 3D Box Studio',
    studioDescription:'在浏览器中打开免费 3D 纸盒工作室，设计尺寸、材质、开合与单面贴图；保存、分享并导出包装效果图。'
  }
};

export function isMigratedLocale(value:string): value is MigratedLocale {
  return (migratedLocales as readonly string[]).includes(value);
}
