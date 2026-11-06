"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionArticle } from "../actions";
import type { WorkflowAction as Action } from "./workflow";

export function WorkflowPanel({
  articleId,
  actions,
  beforeTransition,
}: {
  articleId: string;
  actions: Action[];
  beforeTransition: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Action | null>(null);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (actions.length === 0) return <p className="text-sm text-muted">No workflow actions are available for your role at this status.</p>;

  function run(action: Action) {
    if (action.confirm && !window.confirm(action.confirm)) return;
    setError(null);
    start(async () => {
      if (!(await beforeTransition())) return setError("Save your changes before changing the status.");
      const res = await transitionArticle(articleId, { to: action.to, note: text, publish_at: when });
      if (!res.ok) return setError(res.error);
      setActive(null);
      setText("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={`${a.to}-${a.label}`}
            type="button"
            disabled={pending}
            onClick={() => (a.input ? setActive(a) : run(a))}
            aria-expanded={a.input ? active === a : undefined}
            className={`btn min-h-9 px-3 text-sm ${a.tone === "primary" ? "btn-primary" : a.tone === "danger" ? "bg-accent text-white hover:bg-accent-700" : "btn-outline"}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {active && (
        <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
          {active.input === "schedule" ? (
            <label className="block text-sm font-semibold text-ink">
              Publish date and time (Asia/Manila)
              <input type="datetime-local" className="field mt-1" value={when} onChange={(e) => setWhen(e.target.value)} required />
            </label>
          ) : (
            <label className="block text-sm font-semibold text-ink">
              {active.input === "reason" ? "Rejection reason (required)" : "Note for the author (optional)"}
              <textarea className="field mt-1 min-h-20" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-9 px-3 text-sm"
              disabled={pending || (active.input === "reason" && !text.trim()) || (active.input === "schedule" && !when)}
              onClick={() => run(active)}
            >
              {pending ? "Processing…" : active.label}
            </button>
            <button type="button" className="btn btn-outline min-h-9 px-3 text-sm" onClick={() => setActive(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {pending && !active && <p className="text-sm text-muted">Processing…</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-accent-700">
          {error}
        </p>
      )}
    </div>
  );
}
