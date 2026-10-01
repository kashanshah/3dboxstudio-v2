'use client';

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { defaultLocale, localeDirection, localeStorageKey, resolveLocale, type Locale } from '@/lib/i18n/config';
import { createTranslator } from '@/lib/i18n';

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: ReturnType<typeof createTranslator> };
const LocaleContext = createContext<LocaleContextValue>({ locale: defaultLocale, setLocale: () => {}, t: createTranslator() });
const preferenceEvent = '3dboxstudio:locale-change';
let memoryPreference: Locale | undefined;

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === localeStorageKey || event.key === null) notify(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(preferenceEvent, notify);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(preferenceEvent, notify); };
}

function readPreference(initialLocale: Locale): Locale {
  try { return resolveLocale(localStorage.getItem(localeStorageKey) ?? memoryPreference ?? initialLocale); }
  catch { return memoryPreference ?? initialLocale; }
}

export function LocaleProvider({ children, initialLocale = defaultLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const initial = resolveLocale(initialLocale);
  // Server and first client render agree. Browser preferences are read after hydration.
  // No browser-language detection or automatic redirects at the English-only launch.
  const locale = useSyncExternalStore(subscribe, () => readPreference(initial), () => initial);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);
  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    t: createTranslator(locale),
    setLocale(preference) {
      const next = resolveLocale(preference);
      memoryPreference = next;
      try { localStorage.setItem(localeStorageKey, next); } catch { /* Preference is optional. */ }
      window.dispatchEvent(new Event(preferenceEvent));
    },
  }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() { return useContext(LocaleContext); }
export function useTranslations() { return useI18n().t; }
