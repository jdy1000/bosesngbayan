"use client";

import { useState, useTransition } from "react";
import { ARTICLE_STATUS } from "@/components/studio/ui";
import type { ArticleStatus } from "@/lib/studio/articles";
import { transitionArticle } from "../actions";
import { issuesFor, type ArticleIssue } from "./article-issues";
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

function goTo(target: string) {
  const el = document.getElementById(target);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  if (el instanceof HTMLElement) el.focus({ preventScroll: true });
}

/**
 * Publishing card: status, why the article cannot go out yet, and the actions this role may take.
 * `prepare` saves pending edits (creating the article on the first save) and returns the id to act on.
 * Publishing is always a deliberate click: nothing here publishes by itself.
 */
export function WorkflowPanel({
  status,
  isNew,
  canSave,
  saving,
  actions,
  issues,
  prepare,
  onDone,
  footer,
}: {
  status: ArticleStatus;
  isNew: boolean;
  canSave: boolean;
  saving: boolean;
  actions: Action[];
  /** Everything wrong with the article right now (see article-issues.ts). */
  issues: ArticleIssue[];
  prepare: () => Promise<string | null>;
  onDone: (id: string) => void;
  footer?: React.ReactNode;
}) {
  const [active, setActive] = useState<Action | null>(null);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [pending, start] = useTransition();
  const busy = pending || saving;

  const publishNow = actions.find((a) => a.to === "published");
  const schedule = actions.find((a) => a.to === "scheduled");
  const others = actions.filter((a) => a !== publishNow && a !== schedule);
  // The problems that matter here are the ones that stop an action this person can actually take.
  const relevant = [...new Map(actions.flatMap((a) => issuesFor(a.to, issues)).map((i) => [i.id, i])).values()];

  function run(action: Action, publishAt?: string) {
    const blocking = issuesFor(action.to, issues);
    if (blocking.length > 0) {
      setAttempted(true);
      setError(null);
      goTo(blocking[0]!.target);
      return;
    }
    if (action.to === "scheduled" && !publishAt) {
      setError("Pick the publication date and time first.");
      return;
    }
    if (action.confirm && !window.confirm(action.confirm)) return;
    setError(null);
    start(async () => {
      const id = await prepare();
      if (!id) return setError("Save your changes before changing the status.");
      const res = await transitionArticle(id, { to: action.to, note: text, publish_at: publishAt ?? "" });
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

  const button = (tone: Action["tone"], blocked = false) =>
    `btn w-full justify-center ${blocked ? "opacity-60" : ""} ${tone === "primary" ? "btn-primary" : tone === "danger" ? "bg-paper text-accent-700 shadow-[inset_0_0_0_1px_var(--color-red-200)] hover:bg-red-50" : "btn-outline"}`;

  const actionButton = (a: Action) => {
    const blocked = issuesFor(a.to, issues).length > 0;
    return (
      <button
        key={`${a.to}-${a.label}`}
        type="button"
        disabled={busy}
        aria-disabled={blocked || undefined}
        onClick={() => (a.input && a.input !== "schedule" ? setActive(active === a ? null : a) : run(a))}
        aria-expanded={a.input && a.input !== "schedule" ? active === a : undefined}
        className={button(a.tone, blocked)}
      >
        {a.label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 text-sm">
        <p className="text-ink">
          Current status: <strong>{isNew ? "New draft" : (ARTICLE_STATUS[status]?.label ?? status)}</strong>
        </p>
        <p className="text-xs leading-[1.5] text-muted">{HELP[status]}</p>
      </div>

      {relevant.length > 0 && (
        <div role="region" aria-label="What is missing" className={`rounded-[7px] border px-3.5 py-3 text-[13px] leading-[1.5] ${attempted ? "border-red-200 bg-red-50 text-accent-700" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          <p className="font-bold">{attempted ? "Not sent yet. Fix these first:" : "Before this can be published:"}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {relevant.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => goTo(i.target)} className="text-left underline decoration-dotted underline-offset-2 hover:decoration-solid">
                  {i.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-2">
        {publishNow && actionButton(publishNow)}
        {canSave && (
          <button type="submit" disabled={busy} className={button(publishNow || others.length > 0 ? undefined : "primary")}>
            {saving ? "Saving…" : isNew || status === "draft" || status === "rejected" ? "Save draft" : "Save changes"}
          </button>
        )}
        {others.map(actionButton)}
      </div>

      {active && (
        <div className="space-y-2 rounded-[7px] border border-line bg-surface p-3">
          <label className="block text-xs font-bold text-ink-soft">
            {active.input === "reason" ? "Rejection reason (required)" : "Note for the author (optional)"}
            <textarea className="field mt-[7px] min-h-20 font-normal" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary min-h-9 px-3 text-[13px]" disabled={busy || (active.input === "reason" && !text.trim())} onClick={() => run(active)}>
              {pending ? "Processing…" : active.label}
            </button>
            <button type="button" className="btn btn-outline min-h-9 px-3 text-[13px]" onClick={() => setActive(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {schedule && (
        <div className="space-y-2 border-t border-line pt-4">
          <label className="block text-sm font-semibold text-ink" htmlFor="publish-at">
            Publication date and time
          </label>
          <input id="publish-at" type="datetime-local" className="field" value={when} onChange={(e) => setWhen(e.target.value)} />
          <p className="text-xs text-muted">Asia/Manila time.</p>
          <button
            type="button"
            disabled={busy}
            aria-disabled={issuesFor(schedule.to, issues).length > 0 || undefined}
            onClick={() => run(schedule, when)}
            className={button(undefined, issuesFor(schedule.to, issues).length > 0)}
          >
            {schedule.label} publication
          </button>
        </div>
      )}

      {actions.length === 0 && !canSave && <p className="text-sm text-muted">No publishing actions are available for your role at this status.</p>}
      {pending && !active && <p className="text-sm text-muted">Processing…</p>}
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-[1.5] text-accent-700">
          {error}
        </p>
      )}
      {footer && <div className="text-xs text-muted">{footer}</div>}
    </div>
  );
}
