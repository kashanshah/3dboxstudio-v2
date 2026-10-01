/** Enable a locale only after its UI and content have been reviewed and published. */
export const supportedLocales = ['en'] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = 'en';
export const localeStorageKey = '3dboxstudio.locale';

export function resolveLocale(value?: string | null): Locale {
  const language = value?.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
  return supportedLocales.find(locale => locale === language) ?? defaultLocale;
}

export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return /^(ar|fa|he|ur)(-|$)/.test(locale) ? 'rtl' : 'ltr';
}
