"use client";

import { useRef, useState } from "react";
import { Flag } from "lucide-react";
import { useI18n } from "@/components/public/i18n-provider";
import { postJson } from "@/lib/client/post-json";
import { REPORT_REASON_LABELS, REPORT_REASONS } from "@/lib/report-reasons";

export function ReportButton({ postId, commentId }: { postId?: string; commentId?: string }) {
  const { locale, t } = useI18n();
  const m = t.article.report;
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    const { ok, data } = await postJson("/api/public/v1/reports", {
      postId: postId ?? null,
      commentId: commentId ?? null,
      reason: form.get("reason"),
      details: String(form.get("details") ?? ""),
    });
    setPending(false);
    setState(ok ? { tone: "ok", text: data.message ?? m.thanks } : { tone: "error", text: data.error ?? m.failed });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setState(null);
          dialog.current?.showModal();
        }}
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" /> {m.button}
      </button>
      <dialog ref={dialog} className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-md p-6 backdrop:bg-black/50" aria-label={m.title}>
        {state?.tone === "ok" ? (
          <div className="space-y-4">
            <p role="status" className="text-[0.95rem] text-ink">{state.text}</p>
            <button type="button" className="btn btn-primary w-full" onClick={() => dialog.current?.close()}>
              {m.close}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">{m.title}</h2>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold text-ink">{m.reason}</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-ink-soft">
                  <input type="radio" name="reason" value={r} required className="accent-[var(--color-brand)]" />
                  {REPORT_REASON_LABELS[locale][r]}
                </label>
              ))}
            </fieldset>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">{m.details}</span>
              <textarea name="details" maxLength={1000} rows={3} className="field" />
            </label>
            {state?.tone === "error" && <p role="alert" className="text-sm text-accent">{state.text}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn btn-outline flex-1" onClick={() => dialog.current?.close()}>
                {m.cancel}
              </button>
              <button type="submit" className="btn btn-primary flex-1" disabled={pending}>
                {pending ? m.sending : m.send}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
