import { defineRouting } from 'next-intl/routing';

export const LOCALES = ['en', 'uk'] as const;
export const DEFAULT_LOCALE = 'en' as const;

// Each language's own endonym — shown as-is regardless of the active UI
// locale, so a reader can recognize their language even if the app is
// currently rendered in the other one.
export const LOCALE_LABELS: Record<(typeof LOCALES)[number], string> = {
  en: 'English',
  uk: 'Українська',
};

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Without an explicit maxAge, next-intl's locale cookie has no expiry at
  // all, so browsers treat it as a session cookie — cleared on browser
  // close, not persisted across sessions like the user asked for.
  localeCookie: { maxAge: ONE_YEAR_IN_SECONDS },
});
