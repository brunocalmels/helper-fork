import { SupportedLocale, WidgetTranslations } from "../types";
import { en } from "./en";
import { es } from "./es";

export const locales: Record<SupportedLocale, WidgetTranslations> = {
  en,
  es,
} as const;

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const isSupportedLocale = (locale: string): locale is SupportedLocale => {
  return Object.keys(locales).includes(locale as SupportedLocale);
};

export const getLocale = (requestedLocale?: string): SupportedLocale => {
  if (!requestedLocale) return DEFAULT_LOCALE;
  return isSupportedLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
};
