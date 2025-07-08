import { useWidgetTranslations } from "@/components/widget/i18n";

type Props = {
  currentView: "chat" | "previous";
  configTitle?: string;
  defaultTitle?: string | null;
};

export default function HeaderTitle({ currentView, configTitle, defaultTitle }: Props) {
  const { t } = useWidgetTranslations();

  if (currentView === "previous") {
    return t("ui.history");
  }

  return configTitle ?? defaultTitle ?? "Support";
}
