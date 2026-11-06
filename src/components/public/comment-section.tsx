"use client";

import { useState } from "react";
import { ReportButton } from "@/components/public/report-button";
import { postJson } from "@/lib/client/post-json";

export interface CommentItem {
  id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
  created_label: string;
}

function CommentForm({ target, parentId, onDone }: { target: { articleId?: string; postId?: string }; parentId?: string; onDone?: () => void }) {
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setPending(true);
    const { ok, data } = await postJson("/api/public/v1/comments", {
      articleId: target.articleId ?? null,
      postId: target.postId ?? null,
      parentId: parentId ?? null,
      authorName: String(form.get("authorName") ?? ""),
      authorEmail: String(form.get("authorEmail") ?? ""),
      body: String(form.get("body") ?? ""),
      website: String(form.get("website") ?? ""),
    });
    setPending(false);
    if (ok) {
      formEl.reset();
      onDone?.();
    }
    setState(ok ? { tone: "ok", text: data.message ?? "Salamat!" } : { tone: "error", text: data.error ?? "Hindi naisumite." });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Pangalan</span>
          <input name="authorName" required minLength={2} maxLength={80} autoComplete="name" className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Email (hindi ipapakita, opsyonal)</span>
          <input name="authorEmail" type="email" maxLength={254} autoComplete="email" className="field" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">Komento</span>
        <textarea name="body" required minLength={2} maxLength={2000} rows={4} className="field" />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Ipinapadala…" : parentId ? "Sumagot" : "Ipadala ang komento"}
        </button>
        <p className="text-xs text-muted">Dumadaan sa moderation ang mga komento bago lumabas.</p>
      </div>
      {state && (
        <p role={state.tone === "ok" ? "status" : "alert"} className={`text-sm font-medium ${state.tone === "ok" ? "text-brand-700" : "text-accent"}`}>
          {state.text}
        </p>
      )}
    </form>
  );
}

export function CommentSection({
  comments,
  target,
  isOpen,
}: {
  comments: CommentItem[];
  target: { articleId?: string; postId?: string };
  isOpen: boolean;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const roots = comments.filter((c) => !c.parent_id);
  const replies = (id: string) => comments.filter((c) => c.parent_id === id);

  const renderComment = (c: CommentItem, depth: number) => (
    <li key={c.id} className={depth > 0 ? "ml-5 border-l-2 border-line pl-4" : ""}>
      <div className="py-4">
        <p className="text-sm">
          <strong className="font-semibold text-ink">{c.author_name}</strong>{" "}
          <time dateTime={c.created_at} className="text-muted">
            {c.created_label}
          </time>
        </p>
        <p className="mt-1 whitespace-pre-line text-[0.95rem] text-ink-soft">{c.body}</p>
        <div className="mt-2 flex gap-4">
          {isOpen && depth === 0 && (
            <button type="button" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="text-xs font-semibold text-brand hover:underline">
              Sumagot
            </button>
          )}
          <ReportButton commentId={c.id} />
        </div>
        {replyTo === c.id && (
          <div className="mt-4 rounded-xl bg-surface p-4">
            <CommentForm target={target} parentId={c.id} />
          </div>
        )}
      </div>
      {replies(c.id).length > 0 && <ul>{replies(c.id).map((r) => renderComment(r, depth + 1))}</ul>}
    </li>
  );

  return (
    <section aria-labelledby="comments-heading" className="mt-12 border-t border-line pt-8">
      <h2 id="comments-heading" className="text-2xl font-semibold text-ink">
        Talakayan {comments.length > 0 && <span className="text-muted">({comments.length})</span>}
      </h2>
      {roots.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">{roots.map((c) => renderComment(c, 0))}</ul>
      ) : (
        <p className="mt-3 text-[0.95rem] text-muted">Wala pang naaprubahang komento.</p>
      )}
      {isOpen ? (
        <div className="mt-6 rounded-xl border border-line p-5">
          <h3 className="mb-4 font-semibold text-ink">Mag-iwan ng komento</h3>
          <CommentForm target={target} />
        </div>
      ) : (
        <p className="mt-6 rounded-xl bg-surface px-4 py-3 text-sm text-ink-soft">Sarado na ang komento para dito.</p>
      )}
    </section>
  );
}
