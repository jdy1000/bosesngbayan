import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import {
  Empty,
  Notice,
  PageHeader,
  Pagination,
  Panel,
  Stat,
  StatStrip,
  StatusBadge,
  Table,
  Toolbar,
  ToolbarSearch,
  ToolbarTabs,
  withParams,
  type BadgeTone,
} from "@/components/studio/ui";
import { setSubscriberStatus } from "./actions";

export const metadata: Metadata = { title: "Audience" };

const PAGE_SIZE = 25; // as in the Newsmaker console
const STATUSES = ["subscribed", "unsubscribed", "suppressed"] as const;
const STATUS_MAP: Record<(typeof STATUSES)[number], { label: string; tone: BadgeTone }> = {
  subscribed: { label: "Subscribed", tone: "green" },
  unsubscribed: { label: "Unsubscribed", tone: "neutral" },
  suppressed: { label: "Suppressed", tone: "red" },
};
/** Row buttons: SubmitButton sets its own size, so the smaller one needs `!`. */
const SMALL = "!min-h-9 !px-3 !text-[13px]";

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Newsletter subscribers in the Newsmaker console's shape (ADR-021): figures in one strip, then one panel with
 * status tabs, search, the table and the pager. Boses has no contact-message feature, so there is no Enquiries tab.
 */
export default async function NewsletterPage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireStaffPage("newsletter.view");
  const canManage = ctx.permissions.has("newsletter.manage");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === one(sp.status));
  const q = one(sp.q).trim().slice(0, 120);
  const page = Math.min(10_000, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));

  let query = ctx.supabase
    .from("newsletter_subscribers")
    .select("id, email, status, consent_given, consent_text, consent_at, source, subscribed_at, unsubscribed_at, suppressed_at, suppression_reason", {
      count: "exact",
    })
    .order("subscribed_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("email", `%${q.replace(/[%_]/g, " ")}%`);

  const [{ data, count, error }, { count: activeCount }] = await Promise.all([
    query,
    ctx.supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "subscribed"),
  ]);
  const rows = data ?? [];
  const total = count ?? 0;
  // A page past the end (the last row on it left this status, or a stale link) goes back to a page that exists.
  // PostgREST answers an offset beyond the count with PGRST103 instead of an empty list; the count is unknown then.
  if (page > 1 && (error?.code === "PGRST103" || (!error && rows.length === 0))) {
    redirect(withParams("/admin/newsletter", { q, status, page: Math.max(1, Math.min(page - 1, Math.ceil(total / PAGE_SIZE))) }));
  }
  // Server-side presence check only; the key itself is never read into the page.
  const providerConfigured = Boolean(process.env.RESEND_API_KEY);
  const filtered = Boolean(q || status);
  const signupUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "")}/#newsletter`;

  return (
    <>
      <PageHeader
        title="Audience"
        description="Manage newsletter subscribers, their consent records and unsubscribes."
        actions={
          canManage && (
            <a href={withParams("/admin/newsletter/export", { status })} className="btn btn-outline">
              Export CSV{status ? ` (${STATUS_MAP[status].label})` : ""}
            </a>
          )
        }
      />

      <div className="mb-6">
        <StatStrip label="Audience figures">
          <Stat label="Active subscribers" value={activeCount === null ? "—" : formatNumber(activeCount)} hint="Emails with the “Subscribed” status" />
          <Stat
            label="In this view"
            value={error ? "—" : formatNumber(total)}
            hint={`${status ? STATUS_MAP[status].label : "All statuses"}${q ? ", matching the search" : ""}`}
          />
          <Stat
            label="Email provider"
            value={providerConfigured ? "Key set" : "Not set"}
            hint={providerConfigured ? "RESEND_API_KEY is present, not tested" : "No RESEND_API_KEY on the server"}
          />
        </StatStrip>
      </div>

      <Panel flush>
        <Toolbar>
          <ToolbarTabs
            label="Subscriber status"
            tabs={[undefined, ...STATUSES].map((s) => ({
              key: s ?? "all",
              label: s ? STATUS_MAP[s].label : "All",
              href: withParams("/admin/newsletter", { q, status: s }),
              current: s === status,
            }))}
          />
          <ToolbarSearch action="/admin/newsletter" label="Search email" placeholder="Search email…" defaultValue={q} hidden={{ status }} />
        </Toolbar>

        {error ? (
          <div className="p-5">
            <Notice tone="error">Could not load subscribers.</Notice>
          </div>
        ) : rows.length === 0 ? (
          <Empty bare title={filtered ? "No matching subscribers" : "Your audience starts here"}>
            {filtered ? (
              "Try another search or status."
            ) : (
              <>
                <p>People who subscribe through your publication will appear here, along with their consent details.</p>
                <p className="mt-3">
                  <a href={signupUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-brand hover:underline">
                    View newsletter signup <span aria-hidden="true">↗</span>
                  </a>
                </p>
              </>
            )}
          </Empty>
        ) : (
          <Table plain head={["Email", "Status", "Source", "Subscribed", "Consent", ...(canManage ? ["Actions"] : [])]}>
            {rows.map((r) => {
              const canLift = r.status === "suppressed" && (r.unsubscribed_at === null || new Date(r.unsubscribed_at) < new Date(r.subscribed_at));
              return (
                <tr key={r.id}>
                  <td className="break-all font-semibold text-ink">{r.email}</td>
                  <td>
                    <StatusBadge status={r.status} map={STATUS_MAP} />
                    {r.status === "suppressed" && r.suppression_reason && <p className="mt-1.5 text-[11px] text-muted">{r.suppression_reason}</p>}
                    {r.status === "unsubscribed" && r.unsubscribed_at && <p className="mt-1.5 text-[11px] text-muted">{formatDateTime(r.unsubscribed_at)}</p>}
                  </td>
                  <td className="text-ink-soft">{r.source ?? "—"}</td>
                  <td className="whitespace-nowrap text-ink-soft">{formatDateTime(r.subscribed_at)}</td>
                  <td className="max-w-xs text-xs">
                    <details>
                      <summary className="cursor-pointer font-bold text-brand">
                        {r.consent_given ? "Yes" : "No"} · {formatDateTime(r.consent_at)}
                      </summary>
                      <p className="mt-1 whitespace-pre-line text-ink-soft">{r.consent_text}</p>
                    </details>
                  </td>
                  {canManage && (
                    <td className="min-w-56">
                      <div className="flex flex-col gap-2">
                        {r.status === "subscribed" && (
                          <ActionForm action={setSubscriberStatus} confirm={`Unsubscribe ${r.email}?`}>
                            <input type="hidden" name="id" value={r.id} />
                            <SubmitButton name="status" value="unsubscribed" variant="outline" pendingLabel="Working…" className={SMALL}>
                              Unsubscribe
                            </SubmitButton>
                          </ActionForm>
                        )}
                        {r.status !== "suppressed" && (
                          <details>
                            <summary className="cursor-pointer text-[13px] font-bold text-accent-700">Suppress…</summary>
                            <ActionForm action={setSubscriberStatus} className="mt-2 space-y-2">
                              <input type="hidden" name="id" value={r.id} />
                              <label htmlFor={`reason-${r.id}`} className="sr-only">
                                Suppression reason
                              </label>
                              <input id={`reason-${r.id}`} name="reason" required maxLength={500} placeholder="Reason (e.g. bounce, complaint)" className="field" />
                              <SubmitButton name="status" value="suppressed" variant="danger" pendingLabel="Working…" className={SMALL}>
                                Suppress
                              </SubmitButton>
                            </ActionForm>
                          </details>
                        )}
                        {canLift && (
                          <ActionForm action={setSubscriberStatus} confirm="Lift the suppression and restore the subscription?">
                            <input type="hidden" name="id" value={r.id} />
                            <SubmitButton name="status" value="subscribed" variant="outline" pendingLabel="Working…" className={SMALL}>
                              Lift suppression
                            </SubmitButton>
                          </ActionForm>
                        )}
                        {r.status === "unsubscribed" && <p className="text-xs text-muted">Must re-subscribe on the site to be restored.</p>}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </Table>
        )}

        {!error && (
          <div className="border-t border-line">
            <Pagination
              page={page}
              totalPages={Math.ceil(total / PAGE_SIZE)}
              total={total}
              pageSize={PAGE_SIZE}
              noun={total === 1 ? "subscriber" : "subscribers"}
              hrefFor={(p) => withParams("/admin/newsletter", { q, status, page: p })}
            />
          </div>
        )}
      </Panel>

      <p className="mt-[18px] text-[13px] leading-[1.55] text-muted">
        Only authorized staff can view these records. Newsletter delivery is not connected:{" "}
        {providerConfigured ? "a RESEND_API_KEY is set on the server but has not been tested" : "no email provider is configured"}, and campaign sending is not
        implemented yet, so this page only manages saved subscriptions and sends no email.
      </p>
    </>
  );
}
