import { getTranslations } from "next-intl/server";
import { ThesisForm } from "@/app/[locale]/thesis/ThesisForm";
import { getPositions } from "@/lib/dashboard/get-positions";
import { getInstrumentThesis } from "@/lib/thesis/get-instrument-thesis";

const ThesisPage = async () => {
  const t = await getTranslations("thesisPage");
  const positions = await getPositions();
  const thesisByInstrumentId = new Map(
    await Promise.all(positions.map(async (position) => [position.instrumentId, await getInstrumentThesis(position.instrumentId)] as const)),
  );

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">{t("description")}</p>

      {positions.length === 0 ? (
        <p className="mt-6 text-sm text-black/60 dark:text-white/60">{t("noPositions")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-6">
          {positions.map((position) => (
            <li key={position.instrumentId} className="rounded border border-black/10 p-4 dark:border-white/10">
              <h2 className="font-medium">
                {position.ticker} <span className="text-black/60 dark:text-white/60">{position.name}</span>
              </h2>

              <div className="mt-3">
                <ThesisForm instrumentId={position.instrumentId} initialContent={thesisByInstrumentId.get(position.instrumentId) ?? ""} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ThesisPage;
