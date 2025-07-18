import Link from "next/link";
import { generateHelperAuth, HelperProvider, type HelperWidgetConfig } from "@helperai/react";
import { getBaseUrl } from "@/components/constants";
import { locales } from "@/components/widget/i18n/locales";
import { AppLayout } from "./appLayout";
import LocaleSwitcher from "./localeSwitcher";
import { WidgetButtons } from "./widgetButtons";

export const dynamic = "force-dynamic";

export default async function WidgetTest({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; isVip?: string; anonymous?: string; locale?: string }>;
}) {
  if (getBaseUrl() !== "https://helperai.dev") {
    return <div>Only available in development</div>;
  }

  const { email, isVip, anonymous, locale } = await searchParams;

  const helperAuth = anonymous ? {} : generateHelperAuth({ email: email ?? "test@example.com" });

  const currentLocale = locale === "es" ? "es" : "en";
  const translations = locales[currentLocale];

  const config: HelperWidgetConfig = {
    ...helperAuth,
    title: translations.ui.supportAndHelp,
    locale: locale as "en" | "es" | undefined,
    experimentalReadPage: false,
    enableGuide: true,
    customerMetadata: anonymous
      ? null
      : {
          name: "John Doe",
          value: isVip ? 1000_00 : 100,
          links: {
            "Billing Portal": "https://example.com",
          },
        },
    theme: {
      background: "#b92d5d",
      foreground: "#ffffff",
      primary: "#ffffff",
      accent: "#feb61b",
    },
  };

  return (
    <HelperProvider host="https://helperai.dev" {...config}>
      <div className="flex min-h-screen flex-col items-center bg-white p-4">
        <div className="my-auto w-full max-w-6xl rounded-lg bg-background p-6 shadow-md">
          <WidgetButtons />

          <div className="mt-8 border-t pt-6">
            <h2 className="mb-4 text-xl font-semibold">Demo App</h2>
            <div className="h-[500px] overflow-hidden rounded border shadow-inner">
              <AppLayout />
            </div>
          </div>
        </div>
        <Link href="/widget/test/vanilla" className="mt-4 text-sm text-muted-foreground hover:underline">
          Vanilla JavaScript Test Page →
        </Link>
        <LocaleSwitcher currentLocale={locale} />
      </div>
    </HelperProvider>
  );
}
