"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Eye, History, Save } from "lucide-react";
import { RichTextEditor } from "@/components/studio/rich-text-editor";
import { MediaPicker, type PickedMedia } from "@/components/studio/media-picker";
import { Field, Notice, Panel, StatusBadge } from "@/components/studio/ui";
import { formatDateTime, slugify } from "@/lib/format";
import type { ArticleForEdit, EditorOptions, PickedImage } from "@/lib/studio/articles";
import { saveArticle } from "../actions";
import { SaveIndicator, useAutosave } from "./use-autosave";
import { ContributorsPicker, RelatedPicker, TagPicker } from "./relation-pickers";
import { WorkflowPanel } from "./workflow-panel";
import { availableActions, type WorkflowPerms } from "./workflow";

const KIND_LABEL: Record<string, string> = { island_group: "Pangkat ng isla", region: "Rehiyon", province: "Lalawigan", city: "Lungsod" };

export function ArticleEditor({
  data,
  options,
  perms,
  userId,
}: {
  data: ArticleForEdit;
  options: EditorOptions;
  perms: WorkflowPerms & { taxonomy: boolean };
  userId: string;
}) {
  const { article } = data;
  const formRef = useRef<HTMLFormElement>(null);
  const disabled = !data.canEdit;
  const { status, message, field, savedAt, markDirty, saveNow, isDirty } = useAutosave({
    formRef,
    initialUpdatedAt: article.updated_at,
    save: (expected, fd, rev) => saveArticle(article.id, expected, fd, rev),
    enabled: !disabled,
  });

  const [title, setTitle] = useState(article.title);
  const [slug, setSlug] = useState(article.slug);
  const [slugAuto, setSlugAuto] = useState(!article.first_published_at && article.slug === slugify(article.title, 150));
  const [featured, setFeatured] = useState<PickedImage | PickedMedia | null>(data.image);
  const isAuthor = article.author_id === userId;
  const actions = availableActions(article.status, perms, isAuthor);
  const err = (name: string) => (field === name ? message ?? undefined : undefined);

  async function beforeTransition() {
    return disabled || !isDirty() ? true : saveNow(false);
  }

  return (
    <form
      ref={formRef}
      onInput={(e) => (e.target as HTMLInputElement).name && markDirty()}
      onSubmit={(e) => {
        e.preventDefault();
        void saveNow(true);
      }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 xl:col-span-2">
        <StatusBadge status={article.status} />
        {disabled ? <span className="text-sm text-muted">Basahin lamang</span> : <SaveIndicator status={status} message={message} savedAt={savedAt} />}
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href={`/admin/preview/articles/${article.id}`} target="_blank" onClick={(e) => previewAfterSave(e, isDirty() && !disabled, saveNow)} className="btn btn-outline min-h-9 px-3 text-sm">
            <Eye className="h-4 w-4" aria-hidden="true" /> Preview
          </Link>
          <Link href={`/admin/articles/${article.id}/history`} className="btn btn-outline min-h-9 px-3 text-sm">
            <History className="h-4 w-4" aria-hidden="true" /> Kasaysayan
          </Link>
          {!disabled && (
            <button type="submit" disabled={status === "saving" || status === "conflict"} className="btn btn-primary min-h-9 px-3 text-sm">
              <Save className="h-4 w-4" aria-hidden="true" /> I-save
            </button>
          )}
        </div>
      </div>

      {status === "conflict" && (
        <div className="xl:col-span-2">
          <Notice tone="error">
            {message} Huminto ang autosave. Kopyahin ang iyong mga pagbabago kung kailangan, saka{" "}
            <button type="button" className="font-semibold underline" onClick={() => window.location.reload()}>
              i-reload ang pinakabagong bersyon
            </button>
            .
          </Notice>
        </div>
      )}
      {disabled && (
        <div className="xl:col-span-2">
          <Notice tone="info">
            Hindi mo maaaring i-edit ang artikulong ito sa status na “{article.status}”. Ang mga writer ay nag-e-edit lamang ng sariling draft o ni-reject na
            artikulo.
          </Notice>
        </div>
      )}
      {article.status === "rejected" && article.rejection_reason && (
        <div className="xl:col-span-2">
          <Notice tone="warn">
            <strong>Dahilan ng pag-reject:</strong> {article.rejection_reason}
          </Notice>
        </div>
      )}

      <fieldset disabled={disabled} className="min-w-0 space-y-5">
        <Field label="Pamagat" htmlFor="title" error={err("title")}>
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
              ? "Nailathala na ito: ang pagpalit ng slug ay sisira sa lumang link. Magdagdag ng redirect sa SEO kung papalitan."
              : slugAuto
                ? "Awtomatikong sinusundan ang pamagat hanggang baguhin mo."
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
        <Field label="Excerpt" htmlFor="excerpt" hint="Maikling buod para sa mga card at search." error={err("excerpt")}>
          <textarea id="excerpt" name="excerpt" className="field min-h-20" maxLength={600} defaultValue={article.excerpt ?? ""} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">Nilalaman</p>
          <RichTextEditor name="body" initialContent={article.body} onChange={markDirty} disabled={disabled} label="Nilalaman ng artikulo" />
          <p className="mt-1 text-xs text-muted">Tantiyang pagbasa: {article.reading_minutes} minuto (kinukuwenta muli sa bawat pag-save).</p>
        </div>

        <Panel title="Pinagkunan at pagwawasto">
          <div className="space-y-4">
            <Field label="Source attribution" htmlFor="source_attribution">
              <textarea id="source_attribution" name="source_attribution" className="field min-h-20" maxLength={1000} defaultValue={article.source_attribution ?? ""} />
            </Field>
            <Field label="Correction note" htmlFor="correction_note" hint="Lalabas sa itaas ng artikulo bilang “Pagwawasto”.">
              <textarea id="correction_note" name="correction_note" className="field min-h-20" maxLength={1000} defaultValue={article.correction_note ?? ""} />
            </Field>
          </div>
        </Panel>
      </fieldset>

      <aside className="min-w-0 space-y-5">
        <Panel title="Workflow" description={workflowSummary(article)}>
          <WorkflowPanel articleId={article.id} actions={actions} beforeTransition={beforeTransition} />
        </Panel>

        <fieldset disabled={disabled} className="min-w-0 space-y-5">
          <Panel title="Paglalathala">
            <div className="space-y-4">
              <Field label="Kategorya" htmlFor="category_id" hint="Kailangan bago isumite o i-publish.">
                <select id="category_id" name="category_id" className="field" defaultValue={article.category_id ?? ""}>
                  <option value="">— Walang kategorya —</option>
                  {options.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.is_active ? "" : " (hindi aktibo)"}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">Mga tag</p>
                <TagPicker tags={options.tags} initial={data.tagIds} canCreate={perms.taxonomy} disabled={disabled} onChange={markDirty} />
              </div>
              <Field label="Lokasyon" htmlFor="location_id">
                <select id="location_id" name="location_id" className="field" defaultValue={article.location_id ?? ""}>
                  <option value="">— Walang lokasyon —</option>
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
                <Field label="May-akda" htmlFor="author_id">
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
                  <span className="font-semibold text-ink">May-akda:</span> {options.people.find((p) => p.id === article.author_id)?.display_name ?? "—"}
                </p>
              )}
              <div>
                <p className="mb-1.5 text-sm font-semibold text-ink">Mga kontribyutor</p>
                <ContributorsPicker people={options.people} initial={data.contributors} disabled={disabled} onChange={markDirty} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="allow_comments" defaultChecked={article.allow_comments} /> Payagan ang mga komento (may moderation)
              </label>
            </div>
          </Panel>

          {perms.publish && (
            <Panel title="Homepage placement" description="Para sa may pahintulot mag-publish.">
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
            <MediaPicker name="featured_image_id" label="Larawan" defaultValue={data.image} onChange={(m) => (setFeatured(m), markDirty())} />
            <ImageMeta image={featured} />
          </Panel>

          <Panel title="SEO at social">
            <div className="space-y-4">
              <Field label="SEO title" htmlFor="seo_title" hint="Kung blangko, gagamitin ang pamagat." error={err("seo_title")}>
                <input id="seo_title" name="seo_title" className="field" maxLength={120} defaultValue={article.seo_title ?? ""} />
              </Field>
              <Field label="SEO description" htmlFor="seo_description" hint="Kung blangko, gagamitin ang excerpt." error={err("seo_description")}>
                <textarea id="seo_description" name="seo_description" className="field min-h-20" maxLength={320} defaultValue={article.seo_description ?? ""} />
              </Field>
              <Field label="Canonical URL" htmlFor="canonical_url" hint="Para lamang sa nilalamang unang nailathala sa ibang site." error={err("canonical_url")}>
                <input id="canonical_url" name="canonical_url" type="url" className="field" placeholder="https://…" defaultValue={article.canonical_url ?? ""} />
              </Field>
              <MediaPicker name="og_image_id" label="Open Graph image (opsyonal)" defaultValue={data.og} onChange={markDirty} />
            </div>
          </Panel>

          <Panel title="Kaugnay na mga artikulo">
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
        <p className="font-semibold text-amber-800">Walang alt text ang larawang ito — idagdag ito sa Media Library bago i-publish.</p>
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
      <p className="text-muted">
        Ang alt text, caption at credit ay nakaimbak sa{" "}
        <Link href="/admin/media" className="font-semibold text-brand hover:underline">
          Media Library
        </Link>
        .
      </p>
    </div>
  );
}

function workflowSummary(a: ArticleForEdit["article"]): string {
  if (a.status === "scheduled") return `Lalabas sa ${formatDateTime(a.published_at)}`;
  if (a.status === "published") return `Nailathala ${formatDateTime(a.first_published_at ?? a.published_at)}`;
  if (a.status === "pending_review" && a.submitted_at) return `Isinumite ${formatDateTime(a.submitted_at)}`;
  return `Huling binago ${formatDateTime(a.updated_at)}`;
}
