"use client";

import { useI18n } from "@/components/public/i18n-provider";

export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="container-site flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="text-3xl font-semibold text-ink">{t.common.error.title}</h1>
      <p className="mt-3 max-w-md text-ink-soft">{t.common.error.body}</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">
        {t.common.error.retry}
      </button>
    </div>
  );
}
