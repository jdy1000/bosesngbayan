"use client";

import { useState } from "react";
import { postJson } from "@/lib/client/post-json";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const { ok, data } = await postJson("/api/public/v1/newsletter/unsubscribe", { token });
    setPending(false);
    setState(ok ? { tone: "ok", text: data.message ?? "Na-unsubscribe ka na." } : { tone: "error", text: data.error ?? "Hindi naproseso." });
  }

  if (state?.tone === "ok") return <p role="status" className="mt-4 text-ink">{state.text}</p>;
  return (
    <div className="mt-4 space-y-4">
      <p className="text-ink-soft">Hindi ka na makatatanggap ng newsletter sa email na ito.</p>
      <button type="button" onClick={handleClick} className="btn btn-primary" disabled={pending}>
        {pending ? "Pinoproseso…" : "Kumpirmahin ang pag-unsubscribe"}
      </button>
      {state && <p role="alert" className="text-sm text-accent">{state.text}</p>}
    </div>
  );
}
