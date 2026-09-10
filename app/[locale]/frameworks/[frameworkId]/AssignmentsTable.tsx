import { getTranslations } from "next-intl/server";
import { assignInstrumentAction, revertToAutoAction } from "@/app/[locale]/frameworks/[frameworkId]/actions";
import { ASSIGNMENT_SOURCES, UNCLASSIFIED_ASSIGNMENT_VALUE } from "@/lib/frameworks/consts";
import type { PositionView } from "@/lib/dashboard/types";

interface IAssignmentInfo {
  groupId: string;
  source: (typeof ASSIGNMENT_SOURCES)[number];
  assignedAt: Date;
}

interface IAssignmentsTableProps {
  frameworkId: string;
  groups: { id: string; name: string }[];
  positions: PositionView[];
  assignmentByInstrumentId: Map<string, IAssignmentInfo>;
}

export const AssignmentsTable = async ({
  frameworkId,
  groups,
  positions,
  assignmentByInstrumentId,
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
        {positions.map((position) => {
          const assignment = assignmentByInstrumentId.get(position.instrumentId);
          const isManual = assignment?.source === "manual";

          return (
            <tr key={position.instrumentId} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2 pr-4">{position.ticker}</td>
              <td className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <form action={assignInstrumentAction} className="flex items-center gap-2">
                    <input type="hidden" name="frameworkId" value={frameworkId} />
                    <input type="hidden" name="instrumentId" value={position.instrumentId} />
                    <select
                      name="groupId"
                      defaultValue={assignment?.groupId ?? UNCLASSIFIED_ASSIGNMENT_VALUE}
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
                  {isManual && assignment && (
                    <>
                      <span className="rounded bg-black/10 px-1.5 py-0.5 text-xs dark:bg-white/10">
                        {t("manualAssignmentBadge", { date: assignment.assignedAt.toLocaleDateString() })}
                      </span>
                      <form action={revertToAutoAction}>
                        <input type="hidden" name="frameworkId" value={frameworkId} />
                        <input type="hidden" name="instrumentId" value={position.instrumentId} />
                        <button type="submit" className="rounded border border-black/20 px-2 py-1 text-xs dark:border-white/20">
                          {t("revertToAutoButton")}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
