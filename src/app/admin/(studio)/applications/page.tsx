import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { APPLICATION_ROLES, APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/studio/applications";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Empty, Notice, PageHeader, Pagination, StatusBadge, Table, withParams, type BadgeTone } from "@/components/studio/ui";
import { approveApplication, rejectApplication } from "./actions";

export const metadata: Metadata = { title: "Applications" };

const PAGE_SIZE = 25;
const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const STATUS: Record<ApplicationStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Pending", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
};

const DONE: Record<string, string> = {
  invited: "Approved. The Studio invitation was sent through Supabase Auth.",
  staff: "Approved. This applicant is already a staff member, so no invitation was sent and their role was not changed.",
  rejected: "Application rejected. The applicant is not notified automatically.",
};

const like = (q: string) => `%${q.replace(/[%_,()]/g, " ")}%`;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireStaffPage("users.manage");
  const sp = await searchParams;
  const tab: Tab = TABS.find((t) => t.key === sp.tab)?.key ?? "pending";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);

  const countFor = (status?: ApplicationStatus) => {
    const c = ctx.supabase.from("publisher_applications").select("id", { count: "exact", head: true });
    return status ? c.eq("status", status) : c;
  };
  let query = ctx.supabase
    .from("publisher_applications")
    .select(
      "id, full_name, email, requested_role, organization, portfolio_url, message, status, review_note, reviewed_at, created_at, reviewer:profiles!publisher_applications_reviewed_by_fkey(display_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: tab === "pending" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (tab !== "all") query = query.eq("status", tab);
  if (q) query = query.or(`full_name.ilike.${like(q)},email.ilike.${like(q)}`);

  const [list, pending, approved, rejected, all] = await Promise.all([query, ...APPLICATION_STATUSES.map((s) => countFor(s)), countFor()]);
  const counts: Record<Tab, number | null> = { pending: pending.count, approved: approved.count, rejected: rejected.count, all: all.count };
  const { data, count, error } = list;

  return (
    <>
      <PageHeader
        eyebrow="Publisher onboarding"
        title="Publisher applications"
        description="Review experience and portfolio evidence before granting newsroom access."
      />
      {sp.done && DONE[sp.done] && (
        <div role="status" className="mb-5">
          <Notice tone="success">{DONE[sp.done]}</Notice>
        </div>
      )}
      <nav aria-label="Application status" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={withParams("/admin/applications", { tab: t.key, q })}
            aria-current={tab === t.key ? "page" : undefined}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${tab === t.key ? "bg-navy text-white" : "border border-line bg-paper text-ink-soft hover:border-brand"}`}
          >
            {t.label}
            <span className={`rounded-full px-2 text-xs tabular-nums ${t.key === "pending" && counts.pending ? "bg-accent text-white" : "bg-surface-2 text-ink-soft"}`}>
              {counts[t.key] ?? "–"}
            </span>
          </Link>
        ))}
      </nav>
      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="tab" value={tab} />
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Search name or email…" className="field" />
        </div>
        <button type="submit" className="btn btn-outline min-h-11 px-4 text-sm">
          Search
        </button>
      </form>

      {error ? (
        <Notice tone="error">Could not load applications.</Notice>
      ) : !data?.length ? (
        <Empty title={tab === "pending" && !q ? "No pending applications" : "No matching applications"}>
          New requests from the “Apply for newsroom access” page appear here.
        </Empty>
      ) : (
        <>
          <Table head={["Applicant", "Requested", "Message", "Submitted", "Decision"]}>
            {data.map((a) => (
              <tr key={a.id} className="[&>td]:!align-top">
                <td className="min-w-48">
                  <span className="font-semibold text-ink">{a.full_name}</span>
                  <span className="block break-all text-xs text-muted">{a.email}</span>
                  {a.organization && <span className="block text-xs text-ink-soft">{a.organization}</span>}
                  {a.portfolio_url && (
                    <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block text-xs font-semibold text-brand hover:text-brand-700">
                      Portfolio link
                    </a>
                  )}
                </td>
                <td className="whitespace-nowrap text-ink-soft">{ROLE_LABELS[a.requested_role]}</td>
                <td className="max-w-sm whitespace-pre-line text-xs leading-relaxed text-ink-soft">{a.message}</td>
                <td className="whitespace-nowrap text-xs text-ink-soft">{formatDateTime(a.created_at)}</td>
                <td className="min-w-64">
                  {a.status === "pending" ? (
                    <Decision id={a.id} name={a.full_name} requestedRole={a.requested_role} />
                  ) : (
                    <div className="text-xs text-ink-soft">
                      <StatusBadge status={a.status} map={STATUS} />
                      <span className="mt-1 block">
                        {formatDateTime(a.reviewed_at)}
                        {a.reviewer?.display_name ? ` · ${a.reviewer.display_name}` : ""}
                      </span>
                      {a.review_note && <span className="mt-1 block whitespace-pre-line">{a.review_note}</span>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={page}
            totalPages={Math.ceil((count ?? 0) / PAGE_SIZE)}
            total={count ?? undefined}
            pageSize={PAGE_SIZE}
            noun="applications"
            hrefFor={(n) => withParams("/admin/applications", { tab, q, page: n })}
          />
        </>
      )}
      <p className="mt-2 text-xs text-muted">
        Applicants are not emailed when rejected. Reviewed applications are deleted automatically 180 days after the decision.
      </p>
    </>
  );
}

function Decision({ id, name, requestedRole }: { id: string; name: string; requestedRole: string }) {
  return (
    <div className="space-y-3">
      <ActionForm action={approveApplication} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <label htmlFor={`role-${id}`} className="sr-only">
          Role for {name}
        </label>
        <select id={`role-${id}`} name="role" defaultValue={requestedRole} className="field min-h-9 w-36 py-1 text-sm">
          {APPLICATION_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <SubmitButton pendingLabel="Inviting…" className="!min-h-9 !px-3">
          Approve &amp; invite
        </SubmitButton>
      </ActionForm>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-accent-700">Reject…</summary>
        <ActionForm action={rejectApplication} className="mt-2 space-y-2">
          <input type="hidden" name="id" value={id} />
          <label htmlFor={`note-${id}`} className="sr-only">
            Reason for rejecting {name}
          </label>
          <textarea id={`note-${id}`} name="note" required minLength={3} maxLength={1000} rows={2} placeholder="Reason (staff only)" className="field py-2 text-sm" />
          <SubmitButton variant="danger" pendingLabel="Rejecting…" className="!min-h-9 !px-3">
            Reject
          </SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}
