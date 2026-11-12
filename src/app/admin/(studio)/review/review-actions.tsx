"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionArticle } from "../articles/actions";

type Mode = "approve" | "reject" | null;
const SMALL = "min-h-9 px-3 text-[13px]";

/**
 * Approve (optionally publishing straight away) or return to the author with a required reason.
 * "Approve & publish" is two server transitions; if publishing fails the article stays approved and the error is shown.
 * A finished decision reloads the queue with ?notice=…, which the page turns into a confirmation banner.
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
      let notice: "approved" | "published" | "returned";
      if (mode === "reject") {
        const res = await transitionArticle(articleId, { to: "rejected", note: text });
        if (!res.ok) return setError(res.error);
        notice = "returned";
      } else {
        const approved = await transitionArticle(articleId, { to: "approved", note: text });
        if (!approved.ok) return setError(approved.error);
        notice = "approved";
        if (publish) {
          const published = await transitionArticle(articleId, { to: "published" });
          if (!published.ok) {
            setError(`Approved, but not published: ${published.error}`);
            return router.refresh();
          }
          notice = "published";
        }
      }
      setMode(null);
      setText("");
      router.replace(`/admin/review?notice=${notice}`);
      router.refresh();
    });
  }

  if (!mode) {
    return (
      <>
        <button type="button" className={`btn btn-outline ${SMALL}`} onClick={() => setMode("reject")}>
          Return to author
        </button>
        <button type="button" className={`btn btn-primary ${SMALL}`} onClick={() => setMode("approve")}>
          Approve
        </button>
      </>
    );
  }

  const rejecting = mode === "reject";
  return (
    <div className="w-full space-y-2.5 rounded-[7px] border border-line bg-surface p-3 min-[761px]:w-[330px]">
      <label className="block text-xs font-bold text-ink-soft">
        {rejecting ? "Reason the author will see (required)" : "Note for the author (optional)"}
        <textarea className="field mt-[7px] min-h-20 font-normal" value={text} maxLength={2000} rows={3} onChange={(e) => setText(e.target.value)} autoFocus />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={pending} onClick={() => (setMode(null), setError(null))} className={`btn btn-outline ${SMALL}`}>
          Cancel
        </button>
        {rejecting ? (
          <button
            type="button"
            disabled={pending || !text.trim()}
            onClick={() => run(false)}
            className={`btn bg-paper text-accent-700 shadow-[inset_0_0_0_1px_var(--color-red-200)] hover:bg-red-50 ${SMALL}`}
          >
            {pending ? "Returning…" : "Return to author"}
          </button>
        ) : (
          <>
            <button type="button" disabled={pending} onClick={() => run(false)} className={`btn ${canPublish ? "btn-outline" : "btn-primary"} ${SMALL}`}>
              {pending ? "Approving…" : "Approve only"}
            </button>
            {canPublish && (
              <button type="button" disabled={pending} onClick={() => run(true)} className={`btn btn-primary ${SMALL}`}>
                {pending ? "Publishing…" : "Approve & publish"}
              </button>
            )}
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-[1.5] text-accent-700">
          {error}
        </p>
      )}
    </div>
  );
}
