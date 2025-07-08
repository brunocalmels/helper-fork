import React, { createContext, useContext } from "react";
import { DEFAULT_LOCALE, getLocale, locales } from "./locales";
import { SupportedLocale, WidgetI18nConfig, WidgetTranslations } from "./types";

const WidgetI18nContext = createContext<{
  locale: SupportedLocale;
  translations: WidgetTranslations;
} | null>(null);

export const WidgetI18nProvider = ({ children, config }: { children: React.ReactNode; config?: WidgetI18nConfig }) => {
  const locale = getLocale(config?.locale);
  const translations = locales[locale] || locales[DEFAULT_LOCALE];

  return React.createElement(WidgetI18nContext.Provider, { value: { locale, translations } }, children);
};

const getNestedValue = (obj: any, path: string): any => {
  return path.split(".").reduce((current, key) => current?.[key], obj);
};

export const useWidgetTranslations = () => {
  const context = useContext(WidgetI18nContext);

  if (!context) {
    throw new Error("useWidgetTranslations must be used within a WidgetI18nProvider");
  }

  const { locale, translations } = context;

  const t = (key: string): any => {
    const value = getNestedValue(translations, key);

    if (value === undefined) {
      const fallbackValue = getNestedValue(locales[DEFAULT_LOCALE], key);

      if (fallbackValue === undefined) {
        // eslint-disable-next-line no-console
        console.warn(`Translation key "${key}" not found in any locale`);
        return key;
      }

      return fallbackValue;
    }

    return value;
  };

  return { locale, t, translations };
};

export const useWidgetCommands = () => {
  const { t } = useWidgetTranslations();
  return {
    closeCommands: t("commands.close") as string[],
    screenshotTriggers: t("commands.screenshotTriggers") as string[],
  };
};

export * from "./types";
export { getLocale, isSupportedLocale, DEFAULT_LOCALE } from "./locales";
