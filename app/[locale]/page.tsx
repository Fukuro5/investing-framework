import { getTranslations } from "next-intl/server";
import { FrameworkSwitcher } from "@/app/[locale]/FrameworkSwitcher";
import { GroupAllocationSummary } from "@/app/[locale]/GroupAllocationSummary";
import { PositionsTable } from "@/app/[locale]/PositionsTable";
import { RefreshMarketDataButton } from "@/app/[locale]/RefreshMarketDataButton";
import { withAllocationPercent } from "@/lib/dashboard/allocation";
import { getPositions } from "@/lib/dashboard/get-positions";
import { getActiveFrameworkAllocations } from "@/lib/frameworks/get-group-allocations";
import { listFrameworks } from "@/lib/frameworks/list-frameworks";

const DashboardPage = async ({ params }: PageProps<"/[locale]">) => {
  const { locale } = await params;
  const t = await getTranslations("dashboardPage");
  const [positions, frameworks, activeFrameworkAllocations] = await Promise.all([
    withAllocationPercent(await getPositions()),
    listFrameworks(),
    getActiveFrameworkAllocations(),
  ]);
  const activeFramework = frameworks.find((framework) => framework.isActive) ?? null;

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <RefreshMarketDataButton />
      <PositionsTable positions={positions} locale={locale} />
      <FrameworkSwitcher frameworks={frameworks} activeFrameworkId={activeFramework?.id ?? null} />
      {activeFrameworkAllocations && <GroupAllocationSummary allocations={activeFrameworkAllocations} locale={locale} />}
    </div>
  );
};

export default DashboardPage;
