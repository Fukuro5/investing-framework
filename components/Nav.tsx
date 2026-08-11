import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export const Nav = () => {
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navWidget');

  return (
    <nav className="border-b border-black/10 px-6 py-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <span className="font-semibold">{tCommon('appName')}</span>
          <Link href="/" className="text-sm hover:underline">
            {tNav('dashboardLink')}
          </Link>
          <Link href="/import" className="text-sm hover:underline">
            {tNav('importLink')}
          </Link>
          <Link href="/frameworks" className="text-sm hover:underline">
            {tNav('frameworksLink')}
          </Link>
        </div>
        <LanguageSwitcher />
      </div>
    </nav>
  );
};
