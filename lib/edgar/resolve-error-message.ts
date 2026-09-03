import { getTranslations } from "next-intl/server";
import { EdgarError } from "@/lib/edgar/errors";

// Mirrors lib/frameworks/resolve-error-message.ts.
export const resolveEdgarErrorMessage = async (error: unknown): Promise<string> => {
  const t = await getTranslations("errors.edgar");

  if (error instanceof EdgarError) {
    return t(error.code, error.params);
  }

  return t("generic");
};
