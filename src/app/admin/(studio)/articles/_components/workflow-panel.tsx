"use client";

import { useState, useTransition } from "react";
import { ARTICLE_STATUS } from "@/components/studio/ui";
import type { ArticleStatus } from "@/lib/studio/articles";
import { transitionArticle } from "../actions";
import type { WorkflowAction as Action } from "./workflow";

const HELP: Partial<Record<ArticleStatus, string>> = {
  draft: "Save your work privately, submit it for review, or publish when it is ready.",
  pending_review: "Waiting for an editor. Approve it, or reject it with a reason the author will see.",
  approved: "Approved. Publish it now or schedule it.",
  rejected: "Returned to the author. Revise it, then resubmit.",
  scheduled: "Goes live automatically at the scheduled time (Asia/Manila).",
  published: "Live on the public site. Unpublishing removes it from every list.",
  archived: "Hidden from the public site. Restore it as a draft to work on it again.",
};

/**
 * Publishing card: status, what can happen next, and the actions this role may take.
 * `prepare` saves pending edits (creating the article on the first save) and returns the id to act on.
 */
export function WorkflowPanel({
  status,
  isNew,
  canSave,
  saving,
  actions,
  prepare,
  onDone,
}: {
  status: ArticleStatus;
  isNew: boolean;
  canSave: boolean;
  saving: boolean;
  actions: Action[];
  prepare: () => Promise<string | null>;
  onDone: (id: string) => void;
}) {
  const [active, setActive] = useState<Action | null>(null);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const busy = pending || saving;

  function run(action: Action) {
    if (action.confirm && !window.confirm(action.confirm)) return;
    setError(null);
    start(async () => {
      const id = await prepare();
      if (!id) return setError("Save your changes before changing the status.");
      const res = await transitionArticle(id, { to: action.to, note: text, publish_at: when });
      if (!res.ok) {
        setError(res.error);
        // A new article now exists as a draft even though the transition failed: open it.
        if (isNew) onDone(id);
        return;
      }
      setActive(null);
      setText("");
      onDone(id);
    });
  }

  const button = (tone: Action["tone"]) =>
    `btn w-full justify-center ${tone === "primary" ? "btn-primary" : tone === "danger" ? "bg-paper text-accent-700 shadow-[inset_0_0_0_1px_var(--color-red-200)] hover:bg-red-50" : "btn-outline"}`;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 text-sm">
        <p className="text-ink">
          Current status: <strong>{isNew ? "New draft" : (ARTICLE_STATUS[status]?.label ?? status)}</strong>
        </p>
        <p className="text-xs text-muted">{HELP[status]}</p>
      </div>

      <div className="grid gap-2">
        {actions.map((a) => (
          <button
            key={`${a.to}-${a.label}`}
            type="button"
            disabled={busy}
            onClick={() => (a.input ? setActive(active === a ? null : a) : run(a))}
            aria-expanded={a.input ? active === a : undefined}
            className={button(a.tone)}
          >
            {a.label}
          </button>
        ))}
        {canSave && (
          <button type="submit" disabled={busy} className={button(actions.length === 0 ? "primary" : undefined)}>
            {saving ? "Saving…" : isNew || status === "draft" || status === "rejected" ? "Save draft" : "Save changes"}
          </button>
        )}
      </div>

      {active && (
        <div className="space-y-2 rounded-[7px] border border-line bg-surface p-3">
          {active.input === "schedule" ? (
            <label className="block text-xs font-bold text-ink-soft">
              Publication date and time (Asia/Manila)
              <input type="datetime-local" className="field mt-[7px] font-normal" value={when} onChange={(e) => setWhen(e.target.value)} required />
            </label>
          ) : (
            <label className="block text-xs font-bold text-ink-soft">
              {active.input === "reason" ? "Rejection reason (required)" : "Note for the author (optional)"}
              <textarea className="field mt-[7px] min-h-20 font-normal" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-9 px-3 text-[13px]"
              disabled={busy || (active.input === "reason" && !text.trim()) || (active.input === "schedule" && !when)}
              onClick={() => run(active)}
            >
              {pending ? "Processing…" : active.input === "schedule" ? "Schedule publication" : active.label}
            </button>
            <button type="button" className="btn btn-outline min-h-9 px-3 text-[13px]" onClick={() => setActive(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {actions.length === 0 && !canSave && <p className="text-sm text-muted">No publishing actions are available for your role at this status.</p>}
      {pending && !active && <p className="text-sm text-muted">Processing…</p>}
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-[1.5] text-accent-700">
          {error}
        </p>
      )}
    </div>
  );
}
