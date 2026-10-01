# Internationalization foundation

V2 launches with English UI. `src/lib/i18n/config.ts` is the single enabled-locale list. Browser language does not select a locale or trigger redirects. No language switcher or new locale routes were introduced.

## UI and server copy

The English source catalog lives in `src/lib/i18n/messages/en.ts`. Its typed keys cover navigation, account menus, auth headings and labels, workspace controls, Studio panel copy, template display fields and root/home/Studio metadata. Use `useTranslations()` in client components and `translate()` or `createTranslator(locale)` in server components. Use stable semantic keys for new messages; never rename keys merely because wording changes.

```tsx
const t = useTranslations();
return <button aria-label={t('account.named_account', { name: user.name })}>
  {t('account.account_settings')}
</button>;
```

Interpolation returns plain strings; React escapes them. Do not use translations with `dangerouslySetInnerHTML`. Keep complete sentences in messages, with placeholders instead of joining translated fragments. `formatNumber` and `pluralCategory` provide Intl formatting; choose explicit count forms when migrating count messages.

`LocaleProvider` uses a server snapshot for hydration and a guarded local-storage preference (`3dboxstudio.locale`), with cross-tab updates and an in-memory fallback. `useI18n().setLocale()` normalizes preferences against enabled locales. There is intentionally no account database migration while English is the sole supported UI locale.

## Content and templates

`localizeContent(english, translations, locale)` merges reviewed content overrides field by field and retains English for missing fields. It can wrap marketing content and metadata without changing their source format. Existing long-form marketing copy, blog/legal content, API error responses and remaining dynamically built status/count messages are not fully extracted in this foundation; migrate them before enabling another UI locale.

`getPackagingTemplateCopy(template, t)` returns presentation fields from message keys. Keep original template IDs, parameter keys, category filter values, face/panel names, renderer keys, material values and persisted design data unchanged. Translate these values only at their display boundary. Custom templates fall back to their supplied copy until they have catalog entries.

## URLs and SEO

English keeps `/`, `/studio` and all existing paths. The migrated French, Spanish and German landing pages and existing French article are real content and remain available with their established metadata. These historical content locales do not enable a translated Studio UI. Legacy `/{locale}/studio` paths permanently redirect to `/studio` and are omitted from the sitemap and Studio hreflang. The styled sitemap is retained.

Before enabling a new locale:

1. Add a reviewed catalog satisfying `MessageCatalog`, register it, and migrate remaining dynamic messages.
2. Add localized page content and a routing strategy, keeping English URLs and legacy redirects stable.
3. Derive the server locale from the route and pass it to the provider; set document/content language and direction consistently.
4. Review forms, Google-branded sign-in imagery, number/date/plural formatting, RTL layout if applicable, and keyboard/accessibility copy.
5. Add hreflang and sitemap entries only for published equivalent pages, with reciprocal links and correct canonicals.

Run `node --test scripts/i18n.test.mjs`, typecheck, lint and build before shipping.
