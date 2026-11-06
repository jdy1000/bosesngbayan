"use client";

import { useState } from "react";
import { useI18n } from "@/components/public/i18n-provider";
import { postJson } from "@/lib/client/post-json";

export function UnsubscribeForm({ token }: { token: string }) {
  const u = useI18n().t.newsletter.unsubscribe;
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const { ok, data } = await postJson("/api/public/v1/newsletter/unsubscribe", { token });
    setPending(false);
    setState(ok ? { tone: "ok", text: data.message ?? u.done } : { tone: "error", text: data.error ?? u.failed });
  }

  if (state?.tone === "ok") return <p role="status" className="mt-4 text-ink">{state.text}</p>;
  return (
    <div className="mt-4 space-y-4">
      <p className="text-ink-soft">{u.notice}</p>
      <button type="button" onClick={handleClick} className="btn btn-primary" disabled={pending}>
        {pending ? u.processing : u.confirm}
      </button>
      {state && <p role="alert" className="text-sm text-accent">{state.text}</p>}
    </div>
  );
}
