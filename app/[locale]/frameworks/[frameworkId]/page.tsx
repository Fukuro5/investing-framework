import { getTranslations } from "next-intl/server";
import { ActivateFrameworkButton } from "@/app/[locale]/frameworks/ActivateFrameworkButton";
import { AssignmentsTable } from "@/app/[locale]/frameworks/[frameworkId]/AssignmentsTable";
import { createGroupAction, deleteGroupAction, updateGroupAction } from "@/app/[locale]/frameworks/[frameworkId]/actions";
import { EditFrameworkForm } from "@/app/[locale]/frameworks/[frameworkId]/EditFrameworkForm";
import { GroupForm } from "@/app/[locale]/frameworks/[frameworkId]/GroupForm";
import { DeleteButton } from "@/components/DeleteButton";
import { getPositions } from "@/lib/dashboard/get-positions";
import { getFrameworkDetail } from "@/lib/frameworks/get-framework-detail";

const FrameworkDetailPage = async ({ params }: PageProps<"/[locale]/frameworks/[frameworkId]">) => {
  const { frameworkId } = await params;
  const t = await getTranslations("frameworkDetailPage");
  const [{ framework, assignments, groupsTotal }, positions] = await Promise.all([
    getFrameworkDetail(frameworkId),
    getPositions(),
  ]);
  const assignedGroupByInstrumentId = new Map(assignments.map((assignment) => [assignment.instrumentId, assignment.groupId]));

  return (
    <div className="px-6 py-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{framework.name}</h1>
        {framework.isActive && (
          <span className="rounded bg-black/10 px-2 py-0.5 text-xs dark:bg-white/10">{t("activeBadge")}</span>
        )}
      </div>

      <EditFrameworkForm frameworkId={framework.id} name={framework.name} description={framework.description} />

      <h2 className="mt-10 text-lg font-semibold">{t("groupsTitle")}</h2>
      <p className={`mt-2 text-sm ${groupsTotal.isValid ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
        {groupsTotal.isValid
          ? t("groupsTotalValid")
          : t("groupsTotalInvalid", { minTotal: groupsTotal.minTotal, maxTotal: groupsTotal.maxTotal })}
      </p>
      {!framework.isActive && (
        <div className="mt-2">
          <ActivateFrameworkButton frameworkId={framework.id} />
        </div>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {framework.groups.map((group) => (
          <li key={group.id} className="flex flex-wrap items-end gap-3 rounded border border-black/10 p-3 dark:border-white/10">
            <GroupForm
              action={updateGroupAction}
              hiddenFields={{ groupId: group.id }}
              defaultValues={{
                name: group.name,
                targetAllocationMin: group.targetAllocationMin,
                targetAllocationMax: group.targetAllocationMax,
                priority: group.priority,
              }}
              submitLabel={t("saveButton")}
            />
            <DeleteButton
              action={deleteGroupAction}
              confirmMessage={t("deleteGroupConfirm", { name: group.name })}
              label={t("deleteGroupButton")}
              hiddenFields={{ groupId: group.id }}
            />
          </li>
        ))}
      </ul>

      <h3 className="mt-6 text-base font-semibold">{t("newGroupTitle")}</h3>
      <div className="mt-2">
        <GroupForm action={createGroupAction} hiddenFields={{ frameworkId: framework.id }} submitLabel={t("addGroupButton")} />
      </div>

      <h2 className="mt-10 text-lg font-semibold">{t("assignmentsTitle")}</h2>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">{t("assignmentsDescription")}</p>
      <AssignmentsTable
        frameworkId={framework.id}
        groups={framework.groups}
        positions={positions}
        assignedGroupByInstrumentId={assignedGroupByInstrumentId}
      />
    </div>
  );
};

export default FrameworkDetailPage;
