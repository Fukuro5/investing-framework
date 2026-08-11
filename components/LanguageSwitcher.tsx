"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALES, LOCALE_LABELS } from "@/i18n/routing";

export const LanguageSwitcher = () => {
  const activeLocale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("navWidget");

  return (
    <div className="flex items-center gap-2 text-sm" aria-label={t("languageSwitcherLabel")}>
      {LOCALES.map((locale, index) => (
        <span key={locale} className="flex items-center gap-2">
          {index > 0 && <span className="text-black/30 dark:text-white/30">/</span>}
          {locale === activeLocale ? (
            <span aria-current="true" className="font-semibold">
              {LOCALE_LABELS[locale]}
            </span>
          ) : (
            <Link href={pathname} locale={locale} className="hover:underline">
              {LOCALE_LABELS[locale]}
            </Link>
          )}
        </span>
      ))}
    </div>
  );
};
