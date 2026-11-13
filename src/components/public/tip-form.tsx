"use client";

import { useState } from "react";
import { useI18n } from "@/components/public/i18n-provider";
import { postJson } from "@/lib/client/post-json";

const LABEL = "mb-1 block text-sm font-semibold text-ink";
const HINT = "mt-1 block text-xs text-muted";

/** Tip line form (ADR-024). Sends JSON to /api/public/v1/tips; the server validates everything again. */
export function TipForm() {
  const m = useI18n().t.tips.form;
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const text = (name: string) => String(f.get(name) ?? "");
    setPending(true);
    const { ok, data } = await postJson("/api/public/v1/tips", {
      subject: text("subject"),
      details: text("details"),
      agency: text("agency"),
      location: text("location"),
      evidence: text("evidence"),
      contactName: text("contactName"),
      contact: text("contact"),
      agree: f.get("agree") === "on",
      hp: text("hp"),
    });
    setPending(false);
    if (ok) formEl.reset();
    setState(ok ? { tone: "ok", text: data.message ?? "" } : { tone: "error", text: data.error ?? m.failed });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className={LABEL}>{m.subject}</span>
        <input name="subject" required minLength={5} maxLength={200} placeholder={m.subjectPlaceholder} className="field" />
      </label>
      <label className="block">
        <span className={LABEL}>{m.details}</span>
        <textarea name="details" required minLength={30} maxLength={8000} rows={8} aria-describedby="tip-details-hint" className="field" />
        <span id="tip-details-hint" className={HINT}>{m.detailsHint}</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>{m.agency}</span>
          <input name="agency" maxLength={200} placeholder={m.agencyPlaceholder} className="field" />
        </label>
        <label className="block">
          <span className={LABEL}>{m.location}</span>
          <input name="location" maxLength={120} placeholder={m.locationPlaceholder} className="field" />
        </label>
      </div>
      <label className="block">
        <span className={LABEL}>{m.evidence}</span>
        <textarea name="evidence" rows={3} maxLength={3000} inputMode="url" aria-describedby="tip-evidence-hint" className="field" />
        <span id="tip-evidence-hint" className={HINT}>{m.evidenceHint}</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>{m.contactName}</span>
          <input name="contactName" maxLength={120} autoComplete="off" className="field" />
        </label>
        <label className="block">
          <span className={LABEL}>{m.contact}</span>
          <input name="contact" maxLength={200} autoComplete="off" className="field" />
        </label>
      </div>
      <input type="text" name="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]" />
        {m.agree}
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? m.submitting : m.submit}
      </button>
      {state && (
        <p role={state.tone === "ok" ? "status" : "alert"} className={`text-sm font-medium ${state.tone === "ok" ? "text-brand-700" : "text-accent"}`}>
          {state.text}
        </p>
      )}
    </form>
  );
}
