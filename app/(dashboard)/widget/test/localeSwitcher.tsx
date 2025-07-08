"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Props = {
  currentLocale?: string;
};

export default function LocaleSwitcher({ currentLocale }: Props) {
  const searchParams = useSearchParams();

  const createLocaleUrl = (locale?: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (locale) {
      params.set("locale", locale);
    } else {
      params.delete("locale");
    }

    const queryString = params.toString();
    return `/widget/test${queryString ? `?${queryString}` : ""}`;
  };

  const englishUrl = createLocaleUrl();
  const spanishUrl = createLocaleUrl("es");

  return (
    <div className="mb-6 rounded-lg bg-blue-50 p-4 text-sm">
      <h3 className="font-semibold text-blue-900">🌐 Test Widget Internationalization:</h3>
      <div className="mt-2 space-y-1 text-blue-800">
        <div>
          <strong>English (default):</strong>{" "}
          <Link href={englishUrl} className="underline">
            Switch to English
          </Link>
        </div>
        <div>
          <strong>Spanish:</strong>{" "}
          <Link href={spanishUrl} className="underline">
            Switch to Spanish
          </Link>
        </div>
        <div className="text-xs mt-2">
          Current locale: <code className="bg-blue-100 px-1 rounded">{currentLocale || "en (default)"}</code>
        </div>
        <div className="text-xs mt-1 text-blue-600">
          Current URL:{" "}
          <code className="bg-blue-100 px-1 rounded text-xs">{searchParams.toString() || "(no params)"}</code>
        </div>
      </div>
    </div>
  );
}
