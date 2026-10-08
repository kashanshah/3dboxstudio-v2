import { en } from './messages/en';
import { defaultLocale, resolveLocale, type Locale } from './config';

export type MessageKey = keyof typeof en;
export type MessageCatalog = Record<MessageKey, string>;
export type MessageValues = Record<string, string | number>;
const catalogs: Record<Locale, MessageCatalog> = { en };

/** Shared by server components, metadata and the client provider. No browser globals. */
export function translate(key: MessageKey, values: MessageValues = {}, locale: Locale = defaultLocale): string {
  const template = catalogs[resolveLocale(locale)][key] ?? en[key];
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : token,
  );
}

export function createTranslator(locale: Locale = defaultLocale) {
  return (key: MessageKey, values?: MessageValues) => translate(key, values, locale);
}

/** Partial content translations fall back field by field to the original English content. */
export function localizeContent<T extends object>(english: T, translations: Partial<Record<Locale, Partial<T>>>, locale: Locale): T {
  const translated = translations[resolveLocale(locale)];
  const result = { ...english };
  if (translated) for (const key of Object.keys(translated) as (keyof T)[]) {
    if (translated[key] !== undefined) result[key] = translated[key] as T[keyof T];
  }
  return result;
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions, locale: Locale = defaultLocale) {
  return new Intl.NumberFormat(locale, options).format(value);
}

/** Fixed locale and time zone so server-rendered dates match the browser during hydration. */
export function formatDate(value: string | number | Date, locale: Locale = defaultLocale) {
  return new Date(value).toLocaleDateString(locale, { dateStyle: 'medium', timeZone: 'UTC' });
}

export function pluralCategory(count: number, locale: Locale = defaultLocale) {
  return new Intl.PluralRules(locale).select(count);
}
