import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Field, Notice, PageHeader, Panel } from "@/components/studio/ui";
import { mediaUrl } from "@/lib/media";
import { formatDateTime } from "@/lib/format";
import { MEDIA_KIND_LABELS, MEDIA_LIST_COLUMNS, USAGE_LABELS, formatBytes, getMediaUsages, usageHref } from "@/lib/studio/media";
import { requireAnyPermissionPage } from "../guard";
import { ReplaceFileForm } from "../uploader";
import { deleteMedia, updateExternalUrl, updateMediaMeta } from "../actions";

export const metadata: Metadata = { title: "Media" };

export default async function MediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAnyPermissionPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { data: m, error } = await ctx.supabase.from("media_assets").select(MEDIA_LIST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!m) notFound();
  const usages = await getMediaUsages(ctx, id);
  const url = mediaUrl(m);
  // UX only: RLS and storage policies decide; this just avoids offering controls that will be refused.
  const canEdit = ctx.permissions.has("media.manage_any") || (ctx.permissions.has("media.upload") && m.uploaded_by === ctx.userId);

  return (
    <>
      <PageHeader
        title={m.title || m.file_name}
        breadcrumb={[{ label: "Media Library", href: "/admin/media" }]}
        description={
          <>
            {MEDIA_KIND_LABELS[m.kind]} · in-upload ni {m.uploader?.display_name ?? "hindi kilala"} noong {formatDateTime(m.created_at)}
          </>
        }
      />
      {m.kind === "image" && !m.alt_text && (
        <div className="mb-4">
          <Notice tone="warn">Walang alt text ang larawang ito. Ilarawan ito para sa mga mambabasang gumagamit ng screen reader.</Notice>
        </div>
      )}
      {!canEdit && (
        <div className="mb-4">
          <Notice>Hindi ikaw ang nag-upload nito, kaya pagtingin lamang ang pinapayagan.</Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Panel title="Preview">
            <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-lg bg-surface">
              {m.kind === "image" && url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Studio preview; Supabase URL varies per environment
                <img src={url} alt={m.alt_text ?? ""} className="max-h-[480px] w-auto object-contain" />
              ) : url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
                  Buksan ang {m.kind === "video" ? "video" : "file"} ↗
                </a>
              ) : null}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <Meta label="File">{m.file_name}</Meta>
              <Meta label="Uri">{m.mime_type ?? (m.external_url ? "External" : "—")}</Meta>
              <Meta label="Laki">{m.external_url ? "—" : formatBytes(m.size_bytes)}</Meta>
              <Meta label="Sukat">{m.width && m.height ? `${m.width}×${m.height}` : "—"}</Meta>
            </dl>
            {url && (
              <p className="mt-3 break-all text-xs text-muted">
                URL: <span className="font-mono">{url}</span>
              </p>
            )}
          </Panel>

          {canEdit && (
            <Panel title="Detalye" description="Pamagat, alt text, caption, credit at folder.">
              <ActionForm action={updateMediaMeta} className="space-y-4">
                <input type="hidden" name="id" value={m.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Pamagat" htmlFor="m-title">
                    <input id="m-title" name="title" defaultValue={m.title ?? ""} maxLength={200} className="field" />
                  </Field>
                  <Field label="Pangalan ng file (label)" htmlFor="m-file" hint="Hindi nito binabago ang URL ng file.">
                    <input id="m-file" name="file_name" defaultValue={m.file_name} required maxLength={200} className="field" />
                  </Field>
                </div>
                <Field label="Alt text" htmlFor="m-alt" hint="Maikling paglalarawan ng larawan (hanggang 300 karakter).">
                  <input id="m-alt" name="alt_text" defaultValue={m.alt_text ?? ""} maxLength={300} className="field" />
                </Field>
                <Field label="Caption" htmlFor="m-caption">
                  <textarea id="m-caption" name="caption" defaultValue={m.caption ?? ""} maxLength={600} rows={2} className="field" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Credit" htmlFor="m-credit">
                    <input id="m-credit" name="credit" defaultValue={m.credit ?? ""} maxLength={200} className="field" />
                  </Field>
                  <Field label="Folder" htmlFor="m-folder">
                    <input id="m-folder" name="folder" defaultValue={m.folder} maxLength={60} className="field" />
                  </Field>
                </div>
                <SubmitButton>I-save</SubmitButton>
              </ActionForm>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Saan ginagamit" description="Kasama ang mga draft at ang naka-publish at draft na homepage.">
            {usages.length === 0 ? (
              <p className="text-sm text-muted">Hindi ginagamit kahit saan.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {usages.map((u, i) => {
                  const href = usageHref(u);
                  const label = u.label ?? "Nilalamang hindi mo nakikita";
                  return (
                    <li key={`${u.usage_kind}-${u.ref_id ?? u.label}-${i}`} className="flex flex-wrap items-center gap-2">
                      <Badge tone="blue">{USAGE_LABELS[u.usage_kind] ?? u.usage_kind}</Badge>
                      {href ? (
                        <Link href={href} className="font-semibold text-ink hover:text-brand">
                          {label}
                        </Link>
                      ) : (
                        <span className="font-semibold text-ink">{label}</span>
                      )}
                      {u.detail && <span className="text-xs text-muted">({u.detail})</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {canEdit && m.storage_path && (
            <Panel title="Palitan ang file" description="Mananatili ang media record at mga paggamit; bagong URL ang malilikha.">
              <ReplaceFileForm id={m.id} />
            </Panel>
          )}
          {canEdit && m.external_url && (
            <Panel title="External URL">
              <ActionForm action={updateExternalUrl} className="space-y-3">
                <input type="hidden" name="id" value={m.id} />
                <Field label="URL" htmlFor="m-url">
                  <input id="m-url" name="url" type="url" defaultValue={m.external_url} required className="field" />
                </Field>
                <SubmitButton>I-update ang URL</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {canEdit && (
            <Panel title="Burahin">
              {usages.length > 0 ? (
                <p className="text-sm text-muted">Hindi mabubura habang ginagamit pa ({usages.length}). Alisin muna ito sa mga nakalistang lugar.</p>
              ) : (
                <ActionForm action={deleteMedia} confirm="Permanenteng buburahin ang media na ito. Ituloy?">
                  <input type="hidden" name="id" value={m.id} />
                  <SubmitButton variant="danger" pendingLabel="Binubura…">
                    Burahin ang media
                  </SubmitButton>
                </ActionForm>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="truncate text-ink">{children}</dd>
    </div>
  );
}
