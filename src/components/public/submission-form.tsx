"use client";

import { useState } from "react";
import { postJson } from "@/lib/client/post-json";

export function SubmissionForm({ categories, guidelines }: { categories: { id: string; name: string }[]; guidelines: string }) {
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    setPending(true);
    const { ok, data } = await postJson("/api/public/v1/community/posts", {
      kind: f.get("kind"),
      title: String(f.get("title") ?? ""),
      body: String(f.get("body") ?? ""),
      authorName: String(f.get("authorName") ?? ""),
      authorEmail: String(f.get("authorEmail") ?? ""),
      authorLocation: String(f.get("authorLocation") ?? ""),
      categoryId: f.get("categoryId") ? String(f.get("categoryId")) : null,
      agree: f.get("agree") === "on",
      website: String(f.get("website") ?? ""),
    });
    setPending(false);
    if (ok) formEl.reset();
    setState(ok ? { tone: "ok", text: data.message ?? "Salamat! Susuriin ito ng aming moderator bago ilathala." } : { tone: "error", text: data.error ?? "Hindi naisumite." });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-2 text-sm font-semibold text-ink">Uri</legend>
        <label className="chip cursor-pointer gap-2 has-[:checked]:bg-brand has-[:checked]:text-white">
          <input type="radio" name="kind" value="perspective" defaultChecked className="sr-only" /> Pananaw
        </label>
        <label className="chip cursor-pointer gap-2 has-[:checked]:bg-brand has-[:checked]:text-white">
          <input type="radio" name="kind" value="question" className="sr-only" /> Tanong sa komunidad
        </label>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">Pamagat</span>
        <input name="title" required minLength={5} maxLength={200} className="field" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">Ang iyong pananaw o tanong</span>
        <textarea name="body" required minLength={20} maxLength={5000} rows={7} className="field" />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Pangalan</span>
          <input name="authorName" required minLength={2} maxLength={80} autoComplete="name" className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Lugar (opsyonal)</span>
          <input name="authorLocation" maxLength={120} placeholder="hal. Lungsod ng Cebu" className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Paksa (opsyonal)</span>
          <select name="categoryId" className="field" defaultValue="">
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">Email (hindi ipapakita, opsyonal)</span>
        <input name="authorEmail" type="email" maxLength={254} autoComplete="email" className="field sm:max-w-sm" />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {guidelines && <p className="whitespace-pre-line rounded-xl bg-surface px-4 py-3 text-sm text-ink-soft">{guidelines}</p>}
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
        Sumasang-ayon ako sa community guidelines. Naiintindihan kong susuriin ito ng moderator bago ilathala.
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Isinusumite…" : "Isumite"}
      </button>
      {state && (
        <p role={state.tone === "ok" ? "status" : "alert"} className={`text-sm font-medium ${state.tone === "ok" ? "text-brand-700" : "text-accent"}`}>
          {state.text}
        </p>
      )}
    </form>
  );
}
