import { requireStaffPage } from "@/lib/auth/session";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Empty, Notice, PageHeader, Pagination, Panel, StatusBadge, Table, withParams, type BadgeTone } from "@/components/studio/ui";
import { setSubscriberStatus } from "./actions";

export const metadata = { title: "Newsletter" };

const PAGE_SIZE = 50;
const STATUSES = ["subscribed", "unsubscribed", "suppressed"] as const;
const STATUS_MAP: Record<(typeof STATUSES)[number], { label: string; tone: BadgeTone }> = {
  subscribed: { label: "Naka-subscribe", tone: "green" },
  unsubscribed: { label: "Nag-unsubscribe", tone: "neutral" },
  suppressed: { label: "Suppressed", tone: "red" },
};

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireStaffPage("newsletter.view");
  const canManage = ctx.permissions.has("newsletter.manage");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = (sp.q ?? "").trim().slice(0, 120);
  const page = Math.max(1, Number(sp.page) || 1);

  let query = ctx.supabase
    .from("newsletter_subscribers")
    .select("id, email, status, consent_given, consent_text, consent_at, source, subscribed_at, unsubscribed_at, suppressed_at, suppression_reason", {
      count: "exact",
    })
    .order("subscribed_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("email", `%${q.replace(/[%_]/g, " ")}%`);

  const [{ data: rows, count, error }, { count: activeCount }] = await Promise.all([
    query,
    ctx.supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "subscribed"),
  ]);
  // Server-side presence check only; the key itself is never read into the page.
  const providerConfigured = Boolean(process.env.RESEND_API_KEY);

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Mga subscriber, ang kanilang pahintulot (consent), at pamamahala ng unsubscribe/suppression."
        actions={
          canManage && (
            <a href={withParams("/admin/newsletter/export", { status })} className="btn btn-outline min-h-10 px-4 text-sm">
              I-export CSV{status ? ` (${STATUS_MAP[status].label})` : ""}
            </a>
          )
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Panel title="Aktibong subscriber">
          <p className="text-3xl font-bold tabular-nums text-ink">{activeCount === null ? "—" : formatNumber(activeCount)}</p>
          <p className="mt-1 text-sm text-muted">Bilang ng email na may status na “Naka-subscribe” sa database.</p>
        </Panel>
        <Panel title="Email provider">
          <div className="flex items-center gap-2">
            {providerConfigured ? <Badge tone="green">RESEND_API_KEY naka-set</Badge> : <Badge tone="amber">Walang naka-configure na provider</Badge>}
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            {providerConfigured
              ? "May API key sa server environment, pero hindi pa ito nasusubok mula rito."
              : "Walang RESEND_API_KEY sa server environment."}{" "}
            Ang pagpapadala ng campaign ay <strong>hindi pa ipinapatupad</strong> sa Studio; walang email na ipinapadala mula sa pahinang ito.
          </p>
        </Panel>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="sr-only">
            Hanapin ang email
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Hanapin ang email…" className="field" />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className="field">
            <option value="">Lahat ng status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_MAP[s].label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-outline min-h-11 px-4 text-sm">
          I-filter
        </button>
      </form>

      {error ? (
        <Notice tone="error">Hindi makuha ang mga subscriber.</Notice>
      ) : !rows?.length ? (
        <Empty title={q || status ? "Walang tumugmang subscriber" : "Wala pang subscriber"}>
          Ang mga nag-subscribe sa pampublikong form ay lalabas dito.
        </Empty>
      ) : (
        <>
          <Table head={["Email", "Status", "Pinagmulan", "Nag-subscribe", "Pahintulot", ...(canManage ? ["Aksyon"] : [])]}>
            {rows.map((r) => {
              const canLift = r.status === "suppressed" && (r.unsubscribed_at === null || new Date(r.unsubscribed_at) < new Date(r.subscribed_at));
              return (
                <tr key={r.id}>
                  <td className="break-all font-medium text-ink">{r.email}</td>
                  <td>
                    <StatusBadge status={r.status} map={STATUS_MAP} />
                    {r.status === "suppressed" && r.suppression_reason && <p className="mt-1 text-xs text-muted">{r.suppression_reason}</p>}
                    {r.status === "unsubscribed" && r.unsubscribed_at && <p className="mt-1 text-xs text-muted">{formatDateTime(r.unsubscribed_at)}</p>}
                  </td>
                  <td className="text-ink-soft">{r.source ?? "—"}</td>
                  <td className="text-xs text-ink-soft">{formatDateTime(r.subscribed_at)}</td>
                  <td className="max-w-xs text-xs">
                    <details>
                      <summary className="cursor-pointer font-semibold text-brand">
                        {r.consent_given ? "Oo" : "Hindi"} · {formatDateTime(r.consent_at)}
                      </summary>
                      <p className="mt-1 whitespace-pre-line text-ink-soft">{r.consent_text}</p>
                    </details>
                  </td>
                  {canManage && (
                    <td className="min-w-56">
                      <div className="flex flex-col gap-2">
                        {r.status === "subscribed" && (
                          <ActionForm action={setSubscriberStatus} confirm={`I-unsubscribe ang ${r.email}?`}>
                            <input type="hidden" name="id" value={r.id} />
                            <SubmitButton name="status" value="unsubscribed" variant="outline" pendingLabel="Sandali…">
                              I-unsubscribe
                            </SubmitButton>
                          </ActionForm>
                        )}
                        {r.status !== "suppressed" && (
                          <details>
                            <summary className="cursor-pointer text-sm font-semibold text-accent-700">I-suppress…</summary>
                            <ActionForm action={setSubscriberStatus} className="mt-2 space-y-2">
                              <input type="hidden" name="id" value={r.id} />
                              <label htmlFor={`reason-${r.id}`} className="sr-only">
                                Dahilan ng suppression
                              </label>
                              <input id={`reason-${r.id}`} name="reason" required maxLength={500} placeholder="Dahilan (hal. bounce, reklamo)" className="field" />
                              <SubmitButton name="status" value="suppressed" variant="danger" pendingLabel="Sandali…">
                                I-suppress
                              </SubmitButton>
                            </ActionForm>
                          </details>
                        )}
                        {canLift && (
                          <ActionForm action={setSubscriberStatus} confirm="Alisin ang suppression at ibalik ang subscription?">
                            <input type="hidden" name="id" value={r.id} />
                            <SubmitButton name="status" value="subscribed" variant="ghost" pendingLabel="Sandali…">
                              Alisin ang suppression
                            </SubmitButton>
                          </ActionForm>
                        )}
                        {r.status === "unsubscribed" && <p className="text-xs text-muted">Kailangang mag-subscribe muli sa site para maibalik.</p>}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </Table>
          <Pagination page={page} totalPages={Math.ceil((count ?? 0) / PAGE_SIZE)} hrefFor={(n) => withParams("/admin/newsletter", { q, status, page: n })} />
        </>
      )}
    </>
  );
}
