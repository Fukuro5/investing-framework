import { getTranslations } from "next-intl/server";
import { FrameworkError } from "@/lib/frameworks/errors";

// Server Actions catch a FrameworkError and need a translated, user-facing
// message — `error.message` itself is only for logs/tests, never rendered.
export const resolveFrameworkErrorMessage = async (error: unknown): Promise<string> => {
  const t = await getTranslations("errors.frameworks");

  if (error instanceof FrameworkError) {
    return t(error.code, error.params);
  }

  return t("generic");
};
