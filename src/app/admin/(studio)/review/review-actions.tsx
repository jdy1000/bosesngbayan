"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionArticle } from "../articles/actions";

type Mode = "approve" | "reject" | null;

/**
 * Approve (optionally publishing straight away) or reject with a required reason.
 * "Approve & publish" is two server transitions; if publishing fails the article stays approved and the error is shown.
 */
export function ReviewActions({ articleId, title, canPublish }: { articleId: string; title: string; canPublish: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(publish: boolean) {
    if (publish && !window.confirm(`Approve and publish “${title}” now?`)) return;
    setError(null);
    start(async () => {
      if (mode === "reject") {
        const res = await transitionArticle(articleId, { to: "rejected", note: text });
        if (!res.ok) return setError(res.error);
      } else {
        const approved = await transitionArticle(articleId, { to: "approved", note: text });
        if (!approved.ok) return setError(approved.error);
        if (publish) {
          const published = await transitionArticle(articleId, { to: "published" });
          if (!published.ok) {
            setError(`Approved, but not published: ${published.error}`);
            return router.refresh();
          }
        }
      }
      setMode(null);
      setText("");
      router.refresh();
    });
  }

  if (!mode) {
    return (
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <button type="button" className="btn btn-primary min-h-9 px-3 text-sm" onClick={() => setMode("approve")}>
          Approve
        </button>
        <button type="button" className="btn btn-outline min-h-9 px-3 text-sm" onClick={() => setMode("reject")}>
          Return with reason
        </button>
      </div>
    );
  }

  const rejecting = mode === "reject";
  return (
    <div className="space-y-2 rounded-lg bg-surface p-3 ring-1 ring-line">
      <label className="block text-sm font-semibold text-ink">
        {rejecting ? "Reason the author will see (required)" : "Note for the author (optional)"}
        <textarea className="field mt-1 min-h-20" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} autoFocus />
      </label>
      <div className="flex flex-wrap gap-2">
        {rejecting ? (
          <button type="button" disabled={pending || !text.trim()} onClick={() => run(false)} className="btn min-h-9 bg-accent px-3 text-sm text-white hover:bg-accent-700">
            {pending ? "Returning…" : "Return to author"}
          </button>
        ) : (
          <>
            {canPublish && (
              <button type="button" disabled={pending} onClick={() => run(true)} className="btn btn-primary min-h-9 px-3 text-sm">
                {pending ? "Working…" : "Approve & publish"}
              </button>
            )}
            <button type="button" disabled={pending} onClick={() => run(false)} className={`btn min-h-9 px-3 text-sm ${canPublish ? "btn-outline" : "btn-primary"}`}>
              {pending ? "Working…" : "Approve only"}
            </button>
          </>
        )}
        <button type="button" disabled={pending} onClick={() => (setMode(null), setError(null))} className="btn btn-outline min-h-9 px-3 text-sm">
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-accent-700">
          {error}
        </p>
      )}
    </div>
  );
}
