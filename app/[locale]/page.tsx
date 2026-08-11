import { useTranslations } from "next-intl";

const DashboardPage = () => {
  const t = useTranslations("dashboardPage");

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">{t("emptyState")}</p>
    </div>
  );
};

export default DashboardPage;
