import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Film, LayoutGrid, List } from "lucide-react";
import { requireAnyPermissionPage } from "./guard";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Empty, Field, Notice, PageHeader, Pagination, Panel, Table, withParams } from "@/components/studio/ui";
import { mediaUrl } from "@/lib/media";
import { formatDate } from "@/lib/format";
import { MEDIA_KINDS, MEDIA_KIND_LABELS, MEDIA_LIST_COLUMNS, formatBytes, type MediaKind } from "@/lib/studio/media";
import { MediaUploader } from "./uploader";
import { addExternalMedia } from "./actions";

export const metadata: Metadata = { title: "Media Library" };

const PAGE_SIZE = 48;

type Search = { q?: string; folder?: string; kind?: string; view?: string; page?: string; deleted?: string };

export default async function MediaLibraryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireAnyPermissionPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const folder = (sp.folder ?? "").trim().slice(0, 60);
  const kind = (MEDIA_KINDS as readonly string[]).includes(sp.kind ?? "") ? (sp.kind as MediaKind) : "";
  const view = sp.view === "list" ? "list" : "grid";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const canUpload = ctx.permissions.has("media.upload");

  let query = ctx.supabase
    .from("media_assets")
    .select(MEDIA_LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    query = query.or(`title.ilike.${like},file_name.ilike.${like},alt_text.ilike.${like}`);
  }
  if (folder) query = query.eq("folder", folder);
  if (kind) query = query.eq("kind", kind);

  // shortcut: folder list from the 1000 newest rows; switch to a distinct-folders view if the library grows past that.
  const [{ data: items, count, error }, { data: folderRows }] = await Promise.all([
    query,
    ctx.supabase.from("media_assets").select("folder").order("created_at", { ascending: false }).limit(1000),
  ]);
  const folders = [...new Set((folderRows ?? []).map((r) => r.folder))].sort();
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const base = { q, folder, kind, view };
  const missingAlt = (items ?? []).filter((m) => m.kind === "image" && !m.alt_text).length;

  return (
    <>
      <PageHeader title="Media Library" description="Images, video references and files used in articles, pages and the homepage." />
      {sp.deleted && (
        <div className="mb-4">
          <Notice tone="success">Media deleted.</Notice>
        </div>
      )}

      {canUpload && (
        <div className="mb-6 grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Panel title="Upload" description="The server checks every file by its contents, not its name.">
            <MediaUploader folders={folders} />
          </Panel>
          <Panel title="External media" description="Video or file hosted elsewhere (https only).">
            <ActionForm action={addExternalMedia} className="space-y-3" resetOnSuccess>
              <Field label="URL" htmlFor="ext-url">
                <input id="ext-url" name="url" type="url" required placeholder="https://www.youtube.com/watch?v=…" className="field" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type" htmlFor="ext-kind">
                  <select id="ext-kind" name="kind" defaultValue="video" className="field">
                    {MEDIA_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {MEDIA_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Folder" htmlFor="ext-folder">
                  <input id="ext-folder" name="folder" list="media-folders" placeholder="pangkalahatan" maxLength={60} className="field" />
                </Field>
              </div>
              <Field label="Title" htmlFor="ext-title">
                <input id="ext-title" name="title" maxLength={200} className="field" />
              </Field>
              <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
            </ActionForm>
          </Panel>
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="view" value={view} />
        <div className="min-w-56 flex-1">
          <label htmlFor="media-q" className="mb-1.5 block text-sm font-semibold text-ink">
            Search
          </label>
          <input id="media-q" name="q" type="search" defaultValue={q} placeholder="Title, file name or alt text" className="field" />
        </div>
        <div>
          <label htmlFor="media-filter-folder" className="mb-1.5 block text-sm font-semibold text-ink">
            Folder
          </label>
          <select id="media-filter-folder" name="folder" defaultValue={folder} className="field">
            <option value="">All</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="media-filter-kind" className="mb-1.5 block text-sm font-semibold text-ink">
            Type
          </label>
          <select id="media-filter-kind" name="kind" defaultValue={kind} className="field">
            <option value="">All</option>
            {MEDIA_KINDS.map((k) => (
              <option key={k} value={k}>
                {MEDIA_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-outline min-h-10 px-4 text-sm">
          Filter
        </button>
        <div className="ml-auto flex gap-1" aria-label="View mode">
          <Link
            href={withParams("/admin/media", { ...base, view: "grid" })}
            aria-current={view === "grid" ? "page" : undefined}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${view === "grid" ? "border-brand text-brand" : "border-line text-muted hover:border-brand"}`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Grid</span>
          </Link>
          <Link
            href={withParams("/admin/media", { ...base, view: "list" })}
            aria-current={view === "list" ? "page" : undefined}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${view === "list" ? "border-brand text-brand" : "border-line text-muted hover:border-brand"}`}
          >
            <List className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">List</span>
          </Link>
        </div>
      </form>

      {error && <Notice tone="error">Couldn’t load media. Try refreshing.</Notice>}
      {!error && missingAlt > 0 && (
        <div className="mb-4">
          <Notice tone="warn">{missingAlt} {missingAlt === 1 ? "image" : "images"} on this page {missingAlt === 1 ? "has" : "have"} no alt text. Alt text is needed for accessibility and SEO.</Notice>
        </div>
      )}
      {!error && (items ?? []).length === 0 && (
        <Empty title={q || folder || kind ? "Nothing matches the filter" : "No media yet"}>
          {canUpload ? "Upload the first image with the form above." : "You don't have permission to upload."}
        </Empty>
      )}

      {!error && (items ?? []).length > 0 && view === "grid" && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {(items ?? []).map((m) => (
            <li key={m.id}>
              <Link href={`/admin/media/${m.id}`} className="group block overflow-hidden rounded-2xl bg-paper shadow-card ring-1 ring-line hover:ring-brand">
                <Thumb kind={m.kind} url={mediaUrl(m)} alt={m.alt_text} />
                <div className="px-2.5 py-2">
                  <p className="truncate text-sm font-semibold text-ink">{m.title || m.file_name}</p>
                  <p className="truncate text-xs text-muted">
                    {m.folder} · {formatDate(m.created_at)}
                  </p>
                  {m.kind === "image" && !m.alt_text && <p className="mt-0.5 text-[0.7rem] font-semibold text-amber-700">No alt text</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!error && (items ?? []).length > 0 && view === "list" && (
        <Table head={["", "Title", "Type", "Folder", "Size", "Uploaded by", "Date"]}>
          {(items ?? []).map((m) => (
            <tr key={m.id}>
              <td className="w-20">
                <div className="w-16 overflow-hidden rounded-md">
                  <Thumb kind={m.kind} url={mediaUrl(m)} alt={m.alt_text} />
                </div>
              </td>
              <td>
                <Link href={`/admin/media/${m.id}`} className="font-semibold text-ink hover:text-brand">
                  {m.title || m.file_name}
                </Link>
                <p className="text-xs text-muted">{m.file_name}</p>
                {m.kind === "image" && !m.alt_text && <Badge tone="amber">No alt text</Badge>}
              </td>
              <td>{MEDIA_KIND_LABELS[m.kind]}</td>
              <td>{m.folder}</td>
              <td className="tabular-nums">{m.external_url ? "External" : formatBytes(m.size_bytes)}</td>
              <td>{m.uploader?.display_name ?? "—"}</td>
              <td className="whitespace-nowrap">{formatDate(m.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => withParams("/admin/media", { ...base, page: p })} />
    </>
  );
}

function Thumb({ kind, url, alt }: { kind: MediaKind; url: string | null; alt: string | null }) {
  return (
    <div className="flex aspect-[4/3] items-center justify-center bg-surface">
      {kind === "image" && url ? (
        // eslint-disable-next-line @next/next/no-img-element -- Studio thumbnail; Supabase URL varies per environment
        <img src={url} alt={alt ?? ""} className="h-full w-full object-cover" loading="lazy" />
      ) : kind === "video" ? (
        <Film className="h-7 w-7 text-muted" aria-hidden="true" />
      ) : (
        <FileText className="h-7 w-7 text-muted" aria-hidden="true" />
      )}
    </div>
  );
}
