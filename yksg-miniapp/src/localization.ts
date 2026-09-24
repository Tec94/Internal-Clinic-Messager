import { LocalizedText, MiniLocale } from "@/types";

export const copyFor = (copy: LocalizedText, locale: MiniLocale): string =>
  copy[locale];
