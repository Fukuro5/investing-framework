import { getTranslations } from "next-intl/server";
import { assignInstrumentAction } from "@/app/[locale]/frameworks/[frameworkId]/actions";
import { UNCLASSIFIED_ASSIGNMENT_VALUE } from "@/lib/frameworks/consts";
import type { PositionView } from "@/lib/dashboard/types";

interface IAssignmentsTableProps {
  frameworkId: string;
  groups: { id: string; name: string }[];
  positions: PositionView[];
  assignedGroupByInstrumentId: Map<string, string>;
}

export const AssignmentsTable = async ({
  frameworkId,
  groups,
  positions,
  assignedGroupByInstrumentId,
}: IAssignmentsTableProps) => {
  const t = await getTranslations("frameworkDetailPage");

  if (positions.length === 0) {
    return <p className="mt-2 text-sm text-black/60 dark:text-white/60">{t("noPositionsToAssign")}</p>;
  }

  return (
    <table className="mt-4 w-full max-w-2xl text-left text-sm">
      <thead>
        <tr className="border-b border-black/10 dark:border-white/10">
          <th className="py-2 pr-4 font-medium">{t("instrumentColumn")}</th>
          <th className="py-2 font-medium">{t("groupColumn")}</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((position) => (
          <tr key={position.instrumentId} className="border-b border-black/5 dark:border-white/5">
            <td className="py-2 pr-4">{position.ticker}</td>
            <td className="py-2">
              <form action={assignInstrumentAction} className="flex items-center gap-2">
                <input type="hidden" name="frameworkId" value={frameworkId} />
                <input type="hidden" name="instrumentId" value={position.instrumentId} />
                <select
                  name="groupId"
                  defaultValue={assignedGroupByInstrumentId.get(position.instrumentId) ?? UNCLASSIFIED_ASSIGNMENT_VALUE}
                  className="rounded border border-black/20 px-2 py-1 dark:border-white/20"
                >
                  <option value={UNCLASSIFIED_ASSIGNMENT_VALUE}>{t("unclassifiedOption")}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded border border-black/20 px-2 py-1 text-xs dark:border-white/20">
                  {t("saveAssignmentButton")}
                </button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
