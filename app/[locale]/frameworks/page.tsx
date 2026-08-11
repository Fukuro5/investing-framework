import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ActivateFrameworkButton } from "@/app/[locale]/frameworks/ActivateFrameworkButton";
import { deleteFrameworkAction } from "@/app/[locale]/frameworks/actions";
import { NewFrameworkForm } from "@/app/[locale]/frameworks/NewFrameworkForm";
import { DeleteButton } from "@/components/DeleteButton";
import { listFrameworks } from "@/lib/frameworks/list-frameworks";

const FrameworksPage = async () => {
  const t = await getTranslations("frameworksPage");
  const frameworks = await listFrameworks();

  return (
    <div className="px-6 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">{t("description")}</p>

      {frameworks.length === 0 ? (
        <p className="mt-6 text-sm text-black/60 dark:text-white/60">{t("emptyState")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {frameworks.map((framework) => (
            <li
              key={framework.id}
              className="flex items-center justify-between gap-4 rounded border border-black/10 px-4 py-3 dark:border-white/10"
            >
              <div>
                <Link href={`/frameworks/${framework.id}`} className="font-medium hover:underline">
                  {framework.name}
                </Link>
                {framework.isActive && (
                  <span className="ml-2 rounded bg-black/10 px-2 py-0.5 text-xs dark:bg-white/10">{t("activeBadge")}</span>
                )}
                <p className="text-sm text-black/60 dark:text-white/60">
                  {t("groupCount", { count: framework._count.groups })}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {!framework.isActive && <ActivateFrameworkButton frameworkId={framework.id} />}
                <DeleteButton
                  action={deleteFrameworkAction}
                  confirmMessage={t("deleteConfirm", { name: framework.name })}
                  label={t("deleteButton")}
                  hiddenFields={{ frameworkId: framework.id }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-semibold">{t("createTitle")}</h2>
      <NewFrameworkForm />
    </div>
  );
};

export default FrameworksPage;
