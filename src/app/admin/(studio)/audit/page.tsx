import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { Empty, Field, Notice, PageHeader, Pagination, Table, withParams } from "@/components/studio/ui";

export const metadata: Metadata = { title: "Audit Log" };
const PAGE_SIZE = 50;

/** Known values for the datalists; free text is still allowed because new triggers may add more. */
const KNOWN_ACTIONS = ["insert", "update", "delete", "deactivate", "reactivate", "publish", "update_profile", "subscriber_status:suppressed", "subscriber_status:unsubscribed"];
const KNOWN_ENTITIES = ["user_roles", "role_permissions", "profiles", "site_settings", "redirects", "pages", "polls", "homepage_configurations", "newsletter_subscribers", "media_assets", "categories"];

const filterSchema = z.object({
  action: z.string().trim().max(80).regex(/^[a-z_:.-]*$/i).catch(""),
  entity: z.string().trim().max(80).regex(/^[a-z_]*$/i).catch(""),
  actor: z.uuid().or(z.literal("")).catch(""),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).catch(""),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).catch(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireStaffPage("audit.view");
  const f = filterSchema.parse({ action: "", entity: "", actor: "", from: "", to: "", page: 1, ...(await searchParams) });
  const badRange = f.from !== "" && f.to !== "" && f.from > f.to;

  let query = ctx.supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, details, created_at, actor:profiles(display_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE - 1);
  if (f.action) query = query.eq("action", f.action);
  if (f.entity) query = query.eq("entity_type", f.entity);
  if (f.actor) query = query.eq("actor_id", f.actor);
  // Dates are Manila calendar days (UTC+8, no DST).
  if (f.from && !badRange) query = query.gte("created_at", `${f.from}T00:00:00+08:00`);
  if (f.to && !badRange) query = query.lt("created_at", new Date(Date.parse(`${f.to}T00:00:00+08:00`) + 86_400_000).toISOString());

  const [logsRes, actorsRes] = await Promise.all([query, ctx.supabase.from("profiles").select("id, display_name").order("display_name")]);
  if (logsRes.error) throw logsRes.error;
  if (actorsRes.error) throw actorsRes.error;
  const rows = logsRes.data ?? [];
  const totalPages = Math.ceil((logsRes.count ?? 0) / PAGE_SIZE);
  const filters = { action: f.action, entity: f.entity, actor: f.actor, from: f.from, to: f.to };

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Append-only na tala ng mga sensitibong pagbabago: roles, permissions, settings, redirects, pag-deactivate ng account, at iba pa. Hindi ito nae-edit o nabubura mula sa Studio."
      />
      <form method="get" className="mb-5 grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-line sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Aksyon" htmlFor="a-action">
          <input id="a-action" name="action" list="audit-actions" defaultValue={f.action} className="field min-h-10 py-1.5" />
          <datalist id="audit-actions">{KNOWN_ACTIONS.map((a) => <option key={a} value={a} />)}</datalist>
        </Field>
        <Field label="Entity" htmlFor="a-entity">
          <input id="a-entity" name="entity" list="audit-entities" defaultValue={f.entity} className="field min-h-10 py-1.5" />
          <datalist id="audit-entities">{KNOWN_ENTITIES.map((a) => <option key={a} value={a} />)}</datalist>
        </Field>
        <Field label="Gumawa" htmlFor="a-actor">
          <select id="a-actor" name="actor" defaultValue={f.actor} className="field min-h-10 py-1.5">
            <option value="">Lahat</option>
            {(actorsRes.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mula" htmlFor="a-from">
          <input id="a-from" name="from" type="date" defaultValue={f.from} className="field min-h-10 py-1.5" />
        </Field>
        <Field label="Hanggang" htmlFor="a-to">
          <input id="a-to" name="to" type="date" defaultValue={f.to} className="field min-h-10 py-1.5" />
        </Field>
        <div className="flex items-end gap-2">
          <button type="submit" className="btn btn-primary min-h-10 px-4 text-sm">
            I-filter
          </button>
          <Link href="/admin/audit" className="btn btn-outline min-h-10 px-3 text-sm">
            I-reset
          </Link>
        </div>
      </form>
      {badRange && (
        <div className="mb-4">
          <Notice tone="warn">Ang “Mula” ay dapat bago o kapareho ng “Hanggang”. Hindi inilapat ang petsa.</Notice>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty title="Walang tumugmang tala." />
      ) : (
        <Table head={["Petsa (PHT)", "Gumawa", "Aksyon", "Entity", "Detalye"]}>
          {rows.map((r) => {
            const actor = (r.actor as { display_name: string } | null)?.display_name;
            return (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(r.created_at)}</td>
                <td>{actor ?? <span className="text-muted">System / service</span>}</td>
                <td className="font-mono text-xs">{r.action}</td>
                <td className="text-xs">
                  <span className="font-mono">{r.entity_type}</span>
                  {r.entity_id && <span className="block max-w-[14rem] truncate font-mono text-muted">{r.entity_id}</span>}
                </td>
                <td className="max-w-md">
                  {/* Rendered as text only — never as HTML. */}
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold text-brand">Tingnan</summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface p-3 text-[0.72rem] leading-relaxed text-ink-soft">
                      {JSON.stringify(r.details, null, 2)}
                    </pre>
                  </details>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
      <Pagination page={f.page} totalPages={totalPages} hrefFor={(p) => withParams("/admin/audit", { ...filters, page: p })} />
    </>
  );
}
