import { defineRouting } from 'next-intl/routing';

export const LOCALES = ['en', 'uk'] as const;
export const DEFAULT_LOCALE = 'en' as const;

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
});
