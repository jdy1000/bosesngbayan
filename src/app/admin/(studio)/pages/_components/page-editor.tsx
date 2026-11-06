"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, History, Save } from "lucide-react";
import { RichTextEditor } from "@/components/studio/rich-text-editor";
import { MediaPicker } from "@/components/studio/media-picker";
import { Field, Notice, Panel, StatusBadge } from "@/components/studio/ui";
import { formatDateTime } from "@/lib/format";
import type { PageForEdit } from "@/lib/studio/pages";
import { PAGE_STATUS_LABELS, type PageStatus } from "../status";
import { SaveIndicator, useAutosave } from "../../articles/_components/use-autosave";
import { previewAfterSave } from "../../articles/_components/article-editor";
import { savePage, setPageStatus } from "../actions";

export function PageEditor({ data }: { data: PageForEdit }) {
  const { page } = data;
  const formRef = useRef<HTMLFormElement>(null);
  const { status, message, field, savedAt, markDirty, saveNow, isDirty } = useAutosave({
    formRef,
    initialUpdatedAt: page.updated_at,
    save: (expected, fd, rev) => savePage(page.id, expected, fd, rev),
    enabled: true,
  });
  const [slug, setSlug] = useState(page.slug);
  const err = (name: string) => (field === name ? message ?? undefined : undefined);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form
        ref={formRef}
        onInput={(e) => (e.target as HTMLInputElement).name && markDirty()}
        onSubmit={(e) => {
          e.preventDefault();
          void saveNow(true);
        }}
        className="min-w-0 space-y-5"
      >
        <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <SaveIndicator status={status} message={message} savedAt={savedAt} />
          <div className="ml-auto flex flex-wrap gap-2">
            <Link href={`/admin/preview/pages/${page.id}`} target="_blank" onClick={(e) => previewAfterSave(e, isDirty(), saveNow)} className="btn btn-outline min-h-9 px-3 text-sm">
              <Eye className="h-4 w-4" aria-hidden="true" /> Preview
            </Link>
            <Link href={`/admin/pages/${page.id}/history`} className="btn btn-outline min-h-9 px-3 text-sm">
              <History className="h-4 w-4" aria-hidden="true" /> Revisions
            </Link>
            <button type="submit" disabled={status === "saving" || status === "conflict"} className="btn btn-primary min-h-9 px-3 text-sm">
              <Save className="h-4 w-4" aria-hidden="true" /> Save
            </button>
          </div>
        </div>
        {status === "conflict" && (
          <Notice tone="error">
            {message} Autosave has stopped.{" "}
            <button type="button" className="font-semibold underline" onClick={() => window.location.reload()}>
              Reload the latest version
            </button>
            .
          </Notice>
        )}

        <Field label="Title" htmlFor="title" error={err("title")}>
          <input id="title" name="title" className="field text-lg font-semibold" required maxLength={200} defaultValue={page.title} />
        </Field>
        <Field
          label="Slug"
          htmlFor="slug"
          error={err("slug")}
          hint={page.status === "published" ? `Live at /${slug}. Changing it breaks the old link — add a redirect in SEO.` : `URL: /${slug}`}
        >
          <input
            id="slug"
            name="slug"
            className="field font-mono text-sm"
            required
            maxLength={120}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
        </Field>
        <Field label="Summary" htmlFor="summary" error={err("summary")}>
          <textarea id="summary" name="summary" className="field min-h-20" maxLength={600} defaultValue={page.summary ?? ""} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">Content</p>
          <RichTextEditor name="body" initialContent={page.body} onChange={markDirty} label="Page content" />
        </div>
        <Panel title="SEO">
          <div className="space-y-4">
            <Field label="SEO title" htmlFor="seo_title" error={err("seo_title")}>
              <input id="seo_title" name="seo_title" className="field" maxLength={120} defaultValue={page.seo_title ?? ""} />
            </Field>
            <Field label="SEO description" htmlFor="seo_description" error={err("seo_description")}>
              <textarea id="seo_description" name="seo_description" className="field min-h-20" maxLength={320} defaultValue={page.seo_description ?? ""} />
            </Field>
            <Field label="Canonical URL" htmlFor="canonical_url" error={err("canonical_url")}>
              <input id="canonical_url" name="canonical_url" type="url" className="field" placeholder="https://…" defaultValue={page.canonical_url ?? ""} />
            </Field>
            <MediaPicker name="og_image_id" label="Open Graph image (optional)" defaultValue={data.og} onChange={markDirty} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="robots_noindex" defaultChecked={page.robots_noindex} /> Hide from search engines (noindex)
            </label>
          </div>
        </Panel>
      </form>
      <aside className="min-w-0 space-y-5">
        <Panel title="Status" actions={<StatusBadge status={page.status} map={PAGE_STATUS_LABELS} />}>
          <StatusButtons id={page.id} status={page.status} beforeChange={() => (isDirty() ? saveNow(false) : Promise.resolve(true))} />
          {page.published_at && <p className="mt-3 text-xs text-muted">First published {formatDateTime(page.published_at)}</p>}
        </Panel>
      </aside>
    </div>
  );
}

const STATUS_ACTIONS: Record<PageStatus, { to: PageStatus; label: string; primary?: boolean; confirm?: string }[]> = {
  draft: [
    { to: "published", label: "Publish", primary: true },
    { to: "archived", label: "Archive" },
  ],
  published: [
    { to: "draft", label: "Unpublish", confirm: "This removes the page from the public site. Continue?" },
    { to: "archived", label: "Archive", confirm: "Archive it and remove it from the public site?" },
  ],
  archived: [{ to: "draft", label: "Restore as draft", primary: true }],
};

function StatusButtons({ id, status, beforeChange }: { id: string; status: PageStatus; beforeChange: () => Promise<boolean> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(to: PageStatus, confirm?: string) {
    if (confirm && !window.confirm(confirm)) return;
    setError(null);
    start(async () => {
      if (!(await beforeChange())) return setError("Save your changes before changing the status.");
      const fd = new FormData();
      fd.set("id", id);
      fd.set("to", to);
      const res = await setPageStatus(null, fd);
      if (res && !res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {STATUS_ACTIONS[status].map((a) => (
          <button key={a.to} type="button" disabled={pending} onClick={() => run(a.to, a.confirm)} className={`btn min-h-9 px-3 text-sm ${a.primary ? "btn-primary" : "btn-outline"}`}>
            {a.label}
          </button>
        ))}
      </div>
      {pending && <p className="text-sm text-muted">Processing…</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-accent-700">
          {error}
        </p>
      )}
    </div>
  );
}
