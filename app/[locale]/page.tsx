import { getTranslations } from "next-intl/server";
import { PositionsTable } from "@/app/[locale]/PositionsTable";
import { RefreshMarketDataButton } from "@/app/[locale]/RefreshMarketDataButton";
import { withAllocationPercent } from "@/lib/dashboard/allocation";
import { getPositions } from "@/lib/dashboard/get-positions";

const DashboardPage = async ({ params }: PageProps<"/[locale]">) => {
  const { locale } = await params;
  const t = await getTranslations("dashboardPage");
  const positions = withAllocationPercent(await getPositions());

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <RefreshMarketDataButton />
      <PositionsTable positions={positions} locale={locale} />
    </div>
  );
};

export default DashboardPage;
