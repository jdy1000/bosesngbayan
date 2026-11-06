import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { loadPickedMedia, loadSettings } from "@/lib/studio/settings";
import { REDIRECT_STATUS_CODES } from "@/lib/studio/redirects";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { MediaPicker } from "@/components/studio/media-picker";
import { Badge, Empty, Field, PageHeader, Pagination, Panel, Table, withParams } from "@/components/studio/ui";
import { createRedirect, deleteRedirect, saveSeoSettings, toggleRedirect, updateRedirect } from "./actions";

export const metadata: Metadata = { title: "SEO and Redirects" };
const PAGE_SIZE = 50;

interface RedirectRow {
  id: string;
  source_path: string;
  destination: string;
  status_code: number;
  is_active: boolean;
  updated_at: string;
}

export default async function SeoPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const ctx = await requireStaffPage("seo.manage");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  let query = ctx.supabase
    .from("redirects")
    .select("id, source_path, destination, status_code, is_active, updated_at", { count: "exact" })
    .order("source_path")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    query = query.or(`source_path.ilike.${like},destination.ilike.${like}`);
  }
  const [{ settings }, redirectsRes] = await Promise.all([loadSettings(ctx), query]);
  if (redirectsRes.error) throw redirectsRes.error;
  const seo = settings.seo;
  const og = (seo.default_og_image_id && (await loadPickedMedia(ctx, [seo.default_og_image_id])).get(seo.default_og_image_id)) || null;
  const rows = redirectsRes.data ?? [];
  const totalPages = Math.ceil((redirectsRes.count ?? 0) / PAGE_SIZE);

  return (
    <>
      <PageHeader title="SEO and Redirects" description="Global SEO defaults, redirects, and the site's machine-readable feeds." />

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <Panel title="Global SEO" description="Used when an article, page or category has no SEO of its own.">
          <ActionForm action={saveSeoSettings}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Title template" htmlFor="seo-tt" hint="Must contain %s, e.g. “%s | Boses ng Bayan”.">
                <input id="seo-tt" name="title_template" defaultValue={seo.title_template} maxLength={120} className="field" />
              </Field>
              <Field label="Default title" htmlFor="seo-dt">
                <input id="seo-dt" name="default_title" defaultValue={seo.default_title} maxLength={120} className="field" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Default description" htmlFor="seo-dd" hint="Up to 320 characters.">
                  <textarea id="seo-dd" name="default_description" defaultValue={seo.default_description} maxLength={320} rows={3} className="field" />
                </Field>
              </div>
              <MediaPicker name="default_og_image_id" label="Default Open Graph image" defaultValue={og} />
              <div className="space-y-4">
                <Field label="X handle" htmlFor="seo-x">
                  <input id="seo-x" name="x_handle" defaultValue={seo.x_handle} maxLength={40} placeholder="@bosesngbayan" className="field" />
                </Field>
                <label className="flex items-start gap-2.5 text-sm">
                  <input type="checkbox" name="allow_indexing" defaultChecked={seo.allow_indexing} className="mt-0.5 h-4 w-4" />
                  <span>
                    <span className="font-semibold text-ink">Allow search engine indexing</span>
                    <span className="block text-xs text-muted">When off, robots.txt blocks all crawlers. Use only on staging.</span>
                  </span>
                </label>
              </div>
            </div>
            <div className="mt-6 border-t border-line pt-4">
              <SubmitButton>Save SEO</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
        <Panel title="Feeds and index">
          <ul className="space-y-3 text-sm">
            {[
              ["/sitemap.xml", "XML sitemap of published content."],
              ["/robots.txt", "Crawler rules; follows the indexing setting."],
              ["/rss.xml", "RSS feed of the latest articles."],
            ].map(([href, text]) => (
              <li key={href}>
                <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
                  {href} ↗
                </a>
                <p className="text-xs text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Redirects"
        description="Redirects work on public paths that no longer have content (e.g. an old article or category slug). They can't override a path that has live content. Every change is audited."
      >
        <details className="mb-5 rounded-lg border border-dashed border-line p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand">+ New redirect</summary>
          <ActionForm action={createRedirect} resetOnSuccess className="mt-4">
            <RedirectFields idPrefix="new" />
            <div className="mt-4">
              <SubmitButton>Add</SubmitButton>
            </div>
          </ActionForm>
        </details>

        <form method="get" className="mb-4 flex gap-2">
          <label htmlFor="redirect-q" className="sr-only">
            Search redirects
          </label>
          <input id="redirect-q" name="q" type="search" defaultValue={q} placeholder="Search source or destination…" className="field max-w-md" />
          <button type="submit" className="btn btn-outline min-h-11 px-4 text-sm">
            Search
          </button>
        </form>

        {rows.length === 0 ? (
          <Empty title={q ? "No matching redirects." : "No redirects yet."} />
        ) : (
          <Table head={["Source", "Destination", "Type", "Status", "Modified", ""]}>
            {rows.map((r) => (
              <RedirectRowView key={r.id} r={r} />
            ))}
          </Table>
        )}
        <Pagination page={page} totalPages={totalPages} hrefFor={(p) => withParams("/admin/seo", { q, page: p })} />
      </Panel>
    </>
  );
}

function RedirectRowView({ r }: { r: RedirectRow }) {
  return (
    <tr>
      <td className="font-mono text-xs">{r.source_path}</td>
      <td className="max-w-xs truncate font-mono text-xs">{r.destination}</td>
      <td className="tabular-nums">{r.status_code}</td>
      <td>{r.is_active ? <Badge tone="green">Active</Badge> : <Badge>Disabled</Badge>}</td>
      <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(r.updated_at)}</td>
      <td>
        <div className="flex items-center justify-end gap-1">
          <details className="relative">
            <summary className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-surface-2">Edit</summary>
            <div className="absolute right-0 z-10 mt-1 w-[min(560px,80vw)] rounded-xl border border-line bg-paper p-4 shadow-lg">
              <ActionForm action={updateRedirect}>
                <input type="hidden" name="id" value={r.id} />
                <RedirectFields idPrefix={r.id} r={r} />
                <div className="mt-4">
                  <SubmitButton>Save</SubmitButton>
                </div>
              </ActionForm>
            </div>
          </details>
          <ActionForm action={toggleRedirect}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="ghost" pendingLabel="…" className="!min-h-8 !px-2 text-xs">
              {r.is_active ? "Disable" : "Enable"}
            </SubmitButton>
          </ActionForm>
          <ActionForm action={deleteRedirect} confirm={`Remove the redirect ${r.source_path}?`}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="ghost" pendingLabel="…" className="!min-h-8 !px-2 text-xs text-accent-700">
              Remove
            </SubmitButton>
          </ActionForm>
        </div>
      </td>
    </tr>
  );
}

function RedirectFields({ idPrefix, r }: { idPrefix: string; r?: RedirectRow }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Source path" htmlFor={`${idPrefix}-src`} hint="E.g. /balita/old-slug. /admin, /api, query strings and # are not allowed.">
        <input id={`${idPrefix}-src`} name="source_path" required maxLength={300} defaultValue={r?.source_path} placeholder="/old-path" className="field font-mono text-sm" />
      </Field>
      <Field label="Destination" htmlFor={`${idPrefix}-dst`} hint="A path starting with / or an https:// URL.">
        <input id={`${idPrefix}-dst`} name="destination" required maxLength={500} defaultValue={r?.destination} placeholder="/new-path" className="field font-mono text-sm" />
      </Field>
      <Field label="Type" htmlFor={`${idPrefix}-code`} hint="301/308 = permanent (passes on SEO); 302/307 = temporary.">
        <select id={`${idPrefix}-code`} name="status_code" defaultValue={String(r?.status_code ?? 301)} className="field">
          {REDIRECT_STATUS_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-end gap-2 pb-3 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={r?.is_active ?? true} className="h-4 w-4" /> Active
      </label>
    </div>
  );
}
