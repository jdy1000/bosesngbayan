"use client";

import { useId, useState } from "react";
import { useI18n } from "@/components/public/i18n-provider";

type Status = "idle" | "submitting" | "done" | "error";

export function NewsletterForm({
  consentText,
  source,
  tone = "light",
}: {
  consentText: string;
  source: string;
  tone?: "light" | "dark";
}) {
  const id = useId();
  const { locale, t } = useI18n();
  const m = t.newsletter;
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/public/v1/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          consent: form.get("consent") === "on",
          source,
          // The language this form was rendered in, so the stored consent is the wording on screen.
          locale,
          website: String(form.get("website") ?? ""),
        }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!res.ok) {
        setStatus("error");
        setMessage(body?.error ?? m.failed);
        return;
      }
      setStatus("done");
      setMessage(body?.message ?? m.subscribed);
    } catch {
      setStatus("error");
      setMessage(m.offline);
    }
  }

  const dark = tone === "dark";
  if (status === "done") {
    return (
      <p role="status" className={`rounded px-4 py-3 text-sm font-medium ${dark ? "bg-white/10 text-white" : "bg-brand-50 text-brand-800"}`}>
        {message}
      </p>
    );
  }

  return (
    // Container query: the field and button sit side by side only when this form is wide enough (the footer column is not).
    <form onSubmit={handleSubmit} className="@container flex flex-col gap-3" noValidate={false}>
      <div className="flex flex-col gap-2 @sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          {m.emailLabel}
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          placeholder={m.emailPlaceholder}
          className={`field min-w-0 flex-1 ${dark ? "border-white/20 bg-white/10 text-white placeholder:text-white/60" : ""}`}
        />
        <button type="submit" className={`btn ${dark ? "btn-light" : "btn-primary"}`} disabled={status === "submitting"}>
          {status === "submitting" ? m.submitting : m.subscribe}
        </button>
      </div>
      {/* Honeypot: real visitors never see or fill this field. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className={`flex items-start gap-2 text-xs leading-relaxed ${dark ? "text-white/80" : "text-ink-soft"}`}>
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]" />
        <span>{consentText}</span>
      </label>
      {status === "error" && (
        <p role="alert" className={`text-sm font-medium ${dark ? "text-red-200" : "text-accent"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
