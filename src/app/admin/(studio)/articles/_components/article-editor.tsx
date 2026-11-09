"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, History, Save } from "lucide-react";
import { RichTextEditor } from "@/components/studio/rich-text-editor";
import { MediaPicker, type PickedMedia } from "@/components/studio/media-picker";
import { Field, Notice, Panel, StatusBadge } from "@/components/studio/ui";
import { formatDateTime, slugify } from "@/lib/format";
import type { ArticleForEdit, EditorOptions, PickedImage } from "@/lib/studio/articles";
import { createArticleFromEditor, saveArticle } from "../actions";
import { SaveIndicator, useAutosave } from "./use-autosave";
import { ContributorsPicker, RelatedPicker, TagPicker } from "./relation-pickers";
import { WorkflowPanel } from "./workflow-panel";
import { availableActions, type WorkflowPerms } from "./workflow";

const KIND_LABEL: Record<string, string> = { island_group: "Island group", region: "Region", province: "Province", city: "City" };

export function ArticleEditor({
  data,
  options,
  perms,
  userId,
  isNew = false,
}: {
  data: ArticleForEdit;
  options: EditorOptions;
  perms: WorkflowPerms & { taxonomy: boolean };
  userId: string;
  /** Unsaved article: nothing is written (and autosave stays off) until the first explicit save or action. */
  isNew?: boolean;
}) {
  const { article } = data;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const createdId = useRef<string | null>(null);
  const disabled = !data.canEdit;
  const { status, message, field, savedAt, markDirty, saveNow, isDirty } = useAutosave({
    formRef,
    initialUpdatedAt: article.updated_at,
    save: async (expected, fd, rev) => {
      if (isNew && !createdId.current) {
        const res = await createArticleFromEditor(fd);
        if (res.id) createdId.current = res.id;
        return res;
      }
      return saveArticle(createdId.current ?? article.id, expected, fd, rev);
    },
    enabled: !disabled && !isNew,
  });

  const [title, setTitle] = useState(article.title);
  const [slug, setSlug] = useState(article.slug);
  const [slugAuto, setSlugAuto] = useState(!article.first_published_at && article.slug === slugify(article.title, 150));
  const [featured, setFeatured] = useState<PickedImage | PickedMedia | null>(data.image);
  const isAuthor = article.author_id === userId;
  const actions = availableActions(article.status, perms, isAuthor);
  const err = (name: string) => (field === name ? message ?? undefined : undefined);

  /** Saves pending edits (creating a new article first) and returns the id to act on, or null if saving failed. */
  async function prepare(): Promise<string | null> {
    if (isNew) {
      if (!createdId.current && !(await saveNow(true))) return createdId.current;
      return createdId.current;
    }
    return disabled || !isDirty() || (await saveNow(false)) ? article.id : null;
  }

  function openSaved(id: string) {
    if (isNew) router.replace(`/admin/articles/${id}`);
    else router.refresh();
  }

  return (
    <form
      ref={formRef}
      onInput={(e) => (e.target as HTMLInputElement).name && markDirty()}
      onSubmit={(e) => {
        e.preventDefault();
        void saveNow(true).then(() => {
          if (isNew && createdId.current) router.replace(`/admin/articles/${createdId.current}`);
        });
      }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 xl:col-span-2">
        <StatusBadge status={article.status} />
        {disabled ? (
          <span className="text-sm text-muted">Read only</span>
        ) : isNew && status === "saved" ? (
          <span className="text-sm text-muted">Not saved yet</span>
        ) : (
          <SaveIndicator status={status} message={message} savedAt={savedAt} />
        )}
        <div className={`ml-auto flex flex-wrap gap-2 ${isNew ? "hidden" : ""}`}>
          <Link href={`/admin/preview/articles/${article.id}`} target="_blank" onClick={(e) => previewAfterSave(e, isDirty() && !disabled, saveNow)} className="btn btn-outline min-h-9 px-3 text-sm">
            <Eye className="h-4 w-4" aria-hidden="true" /> Preview
          </Link>
          <Link href={`/admin/articles/${article.id}/history`} className="btn btn-outline min-h-9 px-3 text-sm">
            <History className="h-4 w-4" aria-hidden="true" /> History
          </Link>
          {!disabled && (
            <button type="submit" disabled={status === "saving" || status === "conflict"} className="btn btn-primary min-h-9 px-3 text-sm">
              <Save className="h-4 w-4" aria-hidden="true" /> Save
            </button>
          )}
        </div>
      </div>

      {status === "conflict" && (
        <div className="xl:col-span-2">
          <Notice tone="error">
            {message} Autosave has stopped. Copy your changes if you need them, then{" "}
            <button type="button" className="font-semibold underline" onClick={() => window.location.reload()}>
              reload the latest version
            </button>
            .
          </Notice>
        </div>
      )}
      {disabled && (
        <div className="xl:col-span-2">
          <Notice tone="info">
            You cannot edit this article while its status is “{article.status}”. Writers can only edit their own drafts or rejected
            articles.
          </Notice>
        </div>
      )}
      {article.status === "rejected" && article.rejection_reason && (
        <div className="xl:col-span-2">
          <Notice tone="warn">
            <strong>Rejection reason:</strong> {article.rejection_reason}
          </Notice>
        </div>
      )}

      <fieldset disabled={disabled} className="min-w-0 space-y-5">
        <Field label="Title" htmlFor="title" error={err("title")}>
          <input
            id="title"
            name="title"
            className="field text-lg font-semibold"
            required
            maxLength={300}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (slugAuto) setSlug(slugify(e.target.value, 150));
            }}
          />
        </Field>
        <Field label="Subtitle" htmlFor="subtitle" error={err("subtitle")}>
          <input id="subtitle" name="subtitle" className="field" maxLength={400} defaultValue={article.subtitle ?? ""} />
        </Field>
        <Field
          label="Slug"
          htmlFor="slug"
          error={err("slug")}
          hint={
            article.first_published_at
              ? "Already published: changing the slug breaks the old link. Add a redirect in SEO if you change it."
              : slugAuto
                ? "Follows the title automatically until you edit it."
                : `/balita/${slug}`
          }
        >
          <input
            id="slug"
            name="slug"
            className="field font-mono text-sm"
            required
            maxLength={160}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => {
              setSlugAuto(false);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        </Field>
        <Field label="Excerpt" htmlFor="excerpt" hint="Short summary for cards and search." error={err("excerpt")}>
          <textarea id="excerpt" name="excerpt" className="field min-h-20" maxLength={600} defaultValue={article.excerpt ?? ""} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">Body</p>
          <RichTextEditor name="body" initialContent={article.body} onChange={markDirty} disabled={disabled} label="Article body" />
          <p className="mt-1 text-xs text-muted">Estimated reading time: {article.reading_minutes} min (recalculated on every save).</p>
        </div>

        <Panel title="Sources and corrections">
          <div className="space-y-4">
            <Field label="Source attribution" htmlFor="source_attribution">
              <textarea id="source_attribution" name="source_attribution" className="field min-h-20" maxLength={1000} defaultValue={article.source_attribution ?? ""} />
            </Field>
            <Field label="Correction note" htmlFor="correction_note" hint="Shown at the top of the article as “Pagwawasto” (correction).">
              <textarea id="correction_note" name="correction_note" className="field min-h-20" maxLength={1000} defaultValue={article.correction_note ?? ""} />
            </Field>
          </div>
        </Panel>
      </fieldset>

      <aside className="min-w-0 space-y-5">
        <Panel title="Publishing" description={isNew ? undefined : workflowSummary(article)}>
          <WorkflowPanel
            status={article.status}
            isNew={isNew}
            canSave={!disabled}
            saving={status === "saving"}
            actions={actions}
            prepare={prepare}
            onDone={openSaved}
          />
        </Panel>

        <fieldset disabled={disabled} className="min-w-0 space-y-5">
          <Panel title="Story settings">
            <div className="space-y-4">
              <Field label="Category" htmlFor="category_id" hint="Required before submitting or publishing.">
                <select id="category_id" name="category_id" className="field" defaultValue={article.category_id ?? ""}>
                  <option value="">— No category —</option>
                  {options.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.is_active ? "" : " (inactive)"}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">Tags</p>
                <TagPicker tags={options.tags} initial={data.tagIds} canCreate={perms.taxonomy} disabled={disabled} onChange={markDirty} />
              </div>
              <Field label="Location" htmlFor="location_id">
                <select id="location_id" name="location_id" className="field" defaultValue={article.location_id ?? ""}>
                  <option value="">— No location —</option>
                  {Object.entries(KIND_LABEL).map(([kind, label]) => (
                    <optgroup key={kind} label={label}>
                      {options.locations
                        .filter((l) => l.kind === kind)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              {perms.editAny ? (
                <Field label="Author" htmlFor="author_id">
                  <select id="author_id" name="author_id" className="field" defaultValue={article.author_id}>
                    {options.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="text-sm">
                  <span className="font-semibold text-ink">Author:</span> {options.people.find((p) => p.id === article.author_id)?.display_name ?? "—"}
                </p>
              )}
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">Contributors</p>
                <ContributorsPicker people={options.people} initial={data.contributors} disabled={disabled} onChange={markDirty} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="allow_comments" defaultChecked={article.allow_comments} /> Allow comments (moderated)
              </label>
            </div>
          </Panel>

          {perms.publish && (
            <Panel title="Homepage placement" description="For users with publish permission.">
              <input type="hidden" name="placement_present" value="1" />
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_featured" defaultChecked={article.is_featured} /> Featured story
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_breaking" defaultChecked={article.is_breaking} /> Breaking news
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_editors_pick" defaultChecked={article.is_editors_pick} /> Editor’s pick
                </label>
              </div>
            </Panel>
          )}

          <Panel title="Featured image">
            <MediaPicker name="featured_image_id" label="Image" defaultValue={data.image} onChange={(m) => (setFeatured(m), markDirty())} />
            <ImageMeta image={featured} />
          </Panel>

          <Panel title="SEO and social">
            <div className="space-y-4">
              <Field label="SEO title" htmlFor="seo_title" hint="If blank, the title is used." error={err("seo_title")}>
                <input id="seo_title" name="seo_title" className="field" maxLength={120} defaultValue={article.seo_title ?? ""} />
              </Field>
              <Field label="SEO description" htmlFor="seo_description" hint="If blank, the excerpt is used." error={err("seo_description")}>
                <textarea id="seo_description" name="seo_description" className="field min-h-20" maxLength={320} defaultValue={article.seo_description ?? ""} />
              </Field>
              <Field label="Canonical URL" htmlFor="canonical_url" hint="Only for content first published on another site." error={err("canonical_url")}>
                <input id="canonical_url" name="canonical_url" type="url" className="field" placeholder="https://…" defaultValue={article.canonical_url ?? ""} />
              </Field>
              <MediaPicker name="og_image_id" label="Open Graph image (optional)" defaultValue={data.og} onChange={markDirty} />
            </div>
          </Panel>

          <Panel title="Related articles">
            <RelatedPicker articleId={article.id} initial={data.related} disabled={disabled} onChange={markDirty} />
          </Panel>
        </fieldset>
      </aside>
    </form>
  );
}

/** Preview shows the saved version, so save pending edits first (window opened synchronously to avoid popup blockers). */
export function previewAfterSave(e: React.MouseEvent<HTMLAnchorElement>, dirty: boolean, saveNow: (rev: boolean) => Promise<boolean>) {
  if (!dirty) return;
  e.preventDefault();
  const href = e.currentTarget.href;
  const w = window.open("about:blank", "_blank");
  void saveNow(false).then((ok) => {
    if (ok && w) w.location.href = href;
    else w?.close();
  });
}

function ImageMeta({ image }: { image: PickedImage | PickedMedia | null }) {
  if (!image) return null;
  const caption = "caption" in image ? image.caption : null;
  const credit = "credit" in image ? image.credit : null;
  return (
    <div className="mt-3 space-y-1 text-xs">
      {image.alt_text ? (
        <p>
          <span className="font-semibold text-ink">Alt text:</span> {image.alt_text}
        </p>
      ) : (
        <p className="font-semibold text-amber-800">This image has no alt text. Upload it again with alt text, or choose another image.</p>
      )}
      {caption && (
        <p>
          <span className="font-semibold text-ink">Caption:</span> {caption}
        </p>
      )}
      {credit && (
        <p>
          <span className="font-semibold text-ink">Credit:</span> {credit}
        </p>
      )}
      <p className="text-muted">Alt text, caption and credit are set when the image is uploaded.</p>
    </div>
  );
}

function workflowSummary(a: ArticleForEdit["article"]): string {
  if (a.status === "scheduled") return `Goes live ${formatDateTime(a.published_at)}`;
  if (a.status === "published") return `Published ${formatDateTime(a.first_published_at ?? a.published_at)}`;
  if (a.status === "pending_review" && a.submitted_at) return `Submitted ${formatDateTime(a.submitted_at)}`;
  return `Last modified ${formatDateTime(a.updated_at)}`;
}
