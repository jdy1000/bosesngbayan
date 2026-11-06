import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { loadPickedMedia, loadSettings } from "@/lib/studio/settings";
import { REDIRECT_STATUS_CODES } from "@/lib/studio/redirects";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { MediaPicker } from "@/components/studio/media-picker";
import { Badge, Empty, Field, PageHeader, Pagination, Panel, Table, withParams } from "@/components/studio/ui";
import { createRedirect, deleteRedirect, saveSeoSettings, toggleRedirect, updateRedirect } from "./actions";

export const metadata: Metadata = { title: "SEO at Redirects" };
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
      <PageHeader title="SEO at Redirects" description="Global na SEO defaults, redirects, at mga machine-readable na feed ng site." />

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <Panel title="Global SEO" description="Ginagamit kapag walang sariling SEO ang artikulo, pahina o kategorya.">
          <ActionForm action={saveSeoSettings}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Title template" htmlFor="seo-tt" hint="Dapat may %s, hal. “%s | Boses ng Bayan”.">
                <input id="seo-tt" name="title_template" defaultValue={seo.title_template} maxLength={120} className="field" />
              </Field>
              <Field label="Default title" htmlFor="seo-dt">
                <input id="seo-dt" name="default_title" defaultValue={seo.default_title} maxLength={120} className="field" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Default description" htmlFor="seo-dd" hint="Hanggang 320 character.">
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
                    <span className="font-semibold text-ink">Payagan ang search engine indexing</span>
                    <span className="block text-xs text-muted">Kapag naka-off, hinaharangan ng robots.txt ang lahat ng crawler. Gamitin lamang sa staging.</span>
                  </span>
                </label>
              </div>
            </div>
            <div className="mt-6 border-t border-line pt-4">
              <SubmitButton>I-save ang SEO</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
        <Panel title="Mga feed at index">
          <ul className="space-y-3 text-sm">
            {[
              ["/sitemap.xml", "XML sitemap ng mga nakalathalang nilalaman."],
              ["/robots.txt", "Mga patakaran para sa crawler; sumusunod sa indexing setting."],
              ["/rss.xml", "RSS feed ng mga pinakabagong artikulo."],
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
        description="Gumagana ang redirect sa mga pampublikong path na wala nang nilalaman (hal. lumang slug ng artikulo o kategorya). Hindi nito napapalitan ang path na may aktibong nilalaman. Naka-audit ang bawat pagbabago."
      >
        <details className="mb-5 rounded-lg border border-dashed border-line p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand">+ Bagong redirect</summary>
          <ActionForm action={createRedirect} resetOnSuccess className="mt-4">
            <RedirectFields idPrefix="new" />
            <div className="mt-4">
              <SubmitButton>Idagdag</SubmitButton>
            </div>
          </ActionForm>
        </details>

        <form method="get" className="mb-4 flex gap-2">
          <label htmlFor="redirect-q" className="sr-only">
            Hanapin ang redirect
          </label>
          <input id="redirect-q" name="q" type="search" defaultValue={q} placeholder="Hanapin ang source o destination…" className="field max-w-md" />
          <button type="submit" className="btn btn-outline min-h-11 px-4 text-sm">
            Hanapin
          </button>
        </form>

        {rows.length === 0 ? (
          <Empty title={q ? "Walang tumugmang redirect." : "Wala pang redirect."} />
        ) : (
          <Table head={["Source", "Destination", "Uri", "Status", "Binago", ""]}>
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
      <td>{r.is_active ? <Badge tone="green">Aktibo</Badge> : <Badge>Naka-disable</Badge>}</td>
      <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(r.updated_at)}</td>
      <td>
        <div className="flex items-center justify-end gap-1">
          <details className="relative">
            <summary className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-surface-2">I-edit</summary>
            <div className="absolute right-0 z-10 mt-1 w-[min(560px,80vw)] rounded-xl border border-line bg-white p-4 shadow-lg">
              <ActionForm action={updateRedirect}>
                <input type="hidden" name="id" value={r.id} />
                <RedirectFields idPrefix={r.id} r={r} />
                <div className="mt-4">
                  <SubmitButton>I-save</SubmitButton>
                </div>
              </ActionForm>
            </div>
          </details>
          <ActionForm action={toggleRedirect}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="ghost" pendingLabel="…" className="!min-h-8 !px-2 text-xs">
              {r.is_active ? "I-disable" : "I-enable"}
            </SubmitButton>
          </ActionForm>
          <ActionForm action={deleteRedirect} confirm={`Tanggalin ang redirect ${r.source_path}?`}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton variant="ghost" pendingLabel="…" className="!min-h-8 !px-2 text-xs text-accent-700">
              Tanggalin
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
      <Field label="Source path" htmlFor={`${idPrefix}-src`} hint="Hal. /balita/lumang-slug. Bawal ang /admin, /api, query at #.">
        <input id={`${idPrefix}-src`} name="source_path" required maxLength={300} defaultValue={r?.source_path} placeholder="/lumang-path" className="field font-mono text-sm" />
      </Field>
      <Field label="Destination" htmlFor={`${idPrefix}-dst`} hint="Path na nagsisimula sa / o https:// URL.">
        <input id={`${idPrefix}-dst`} name="destination" required maxLength={500} defaultValue={r?.destination} placeholder="/bagong-path" className="field font-mono text-sm" />
      </Field>
      <Field label="Uri" htmlFor={`${idPrefix}-code`} hint="301/308 = permanente (inililipat ang SEO); 302/307 = pansamantala.">
        <select id={`${idPrefix}-code`} name="status_code" defaultValue={String(r?.status_code ?? 301)} className="field">
          {REDIRECT_STATUS_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-end gap-2 pb-3 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={r?.is_active ?? true} className="h-4 w-4" /> Aktibo
      </label>
    </div>
  );
}
