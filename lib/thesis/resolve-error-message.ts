import { getTranslations } from "next-intl/server";

// Thesis content has no domain-specific validation (any free text,
// including empty, is valid), so unlike lib/metrics/resolve-error-message.ts
// there's no custom error type to branch on — this always resolves to the
// generic message, kept as its own module so actions.ts follows the same
// try/catch-and-translate shape as the other Server Actions.
export const resolveThesisErrorMessage = async (): Promise<string> => {
  const t = await getTranslations("errors.thesis");
  return t("generic");
};
