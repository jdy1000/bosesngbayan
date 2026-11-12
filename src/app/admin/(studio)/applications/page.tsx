import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { APPLICATION_ROLES, APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/studio/applications";
import { safeLike } from "@/lib/studio/articles";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Empty, Notice, PageHeader, Pagination, Panel, RecordList, RecordMeta, RecordRow, RecordTitle, StatusBadge, Toolbar, ToolbarSearch, ToolbarTabs, withParams, type BadgeTone } from "@/components/studio/ui";
import { reviewApplication } from "./actions";

export const metadata: Metadata = { title: "Applications" };

const PAGE_SIZE = 10; // as in the Newsmaker console
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
// SubmitButton sets its own size, so the row size needs the important flag.
const SMALL = "!min-h-9 !px-3 !text-[13px]";

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

/** What the banner says after a decision. The key comes from the URL, so only these fixed texts can be shown. */
const DONE: Record<string, string> = {
  invited: "Approved. The Studio invitation was sent through Supabase Auth.",
  staff: "Approved. This applicant is already a staff member, so no invitation was sent and their role was not changed.",
  rejected: "Application rejected. The applicant is not notified automatically.",
};

/**
 * Requests from the public "Apply for newsroom access" form, in the Newsmaker console's shape. An application
 * grants nothing by itself: approval sends the normal invitation, and every decision is re-checked and audited
 * in review_publisher_application().
 */
export default async function ApplicationsPage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireStaffPage("users.manage");
  const sp = await searchParams;
  const tab: Tab = TABS.find((t) => t.key === one(sp.tab))?.key ?? "pending";
  const q = one(sp.q).trim().slice(0, 120);
  const page = Math.min(10_000, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));
  const doneKey = one(sp.done);
  const done = Object.hasOwn(DONE, doneKey) ? DONE[doneKey] : undefined; // own keys only: ?done=constructor must not render

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
  if (q) query = query.or(`full_name.ilike.${safeLike(q)},email.ilike.${safeLike(q)}`);

  const [list, pending, approved, rejected, all] = await Promise.all([query, ...APPLICATION_STATUSES.map((s) => countFor(s)), countFor()]);
  const counts: Record<Tab, number | null> = { pending: pending.count, approved: approved.count, rejected: rejected.count, all: all.count };
  const { data, count, error } = list;
  const total = count ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Publisher onboarding"
        title="Publisher applications"
        description="Review experience and portfolio evidence before granting newsroom access."
      />
      {done && (
        <div className="mb-6">
          <Notice tone="success">{done}</Notice>
        </div>
      )}

      <Panel flush>
        <Toolbar>
          <ToolbarTabs
            label="Application status"
            tabs={TABS.map((t) => ({
              key: t.key,
              label: (
                <>
                  {t.label}
                  <span className="font-normal tabular-nums opacity-75">{counts[t.key] ?? "–"}</span>
                </>
              ),
              href: withParams("/admin/applications", { tab: t.key, q }),
              current: tab === t.key,
            }))}
          />
          <ToolbarSearch action="/admin/applications" label="Search applications" placeholder="Search applications…" defaultValue={q} hidden={{ tab }} />
        </Toolbar>

        {error ? (
          <div className="px-[22px] py-5">
            <Notice tone="error">Could not load applications.</Notice>
          </div>
        ) : !data?.length ? (
          <Empty bare title="No applications found">
            {q || tab !== "all" ? "Try another search or status." : "New publisher applications will appear here."}
          </Empty>
        ) : (
          <RecordList label="Publisher applications">
            {data.map((a) => (
              <RecordRow key={a.id} actions={a.status === "pending" && <Decision id={a.id} name={a.full_name} requestedRole={a.requested_role} />}>
                <RecordMeta>
                  <StatusBadge status={a.status} map={STATUS} />
                  <span>Applied {formatDateTime(a.created_at)}</span>
                </RecordMeta>
                <RecordTitle>{a.full_name}</RecordTitle>
                <p className="break-all text-[13px] text-ink-soft">{a.email}</p>
                <p className="mt-1 text-xs text-muted">
                  Requested role: {ROLE_LABELS[a.requested_role]}
                  {a.organization ? ` · ${a.organization}` : ""}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.55] text-ink-soft">{a.message}</p>
                {a.portfolio_url && (
                  <p className="mt-3 text-[13px] font-bold">
                    <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand hover:underline">
                      Portfolio link <span aria-hidden="true">↗</span>
                    </a>
                  </p>
                )}
                {a.status !== "pending" && (
                  <div className="mt-3 border-t border-line pt-3 text-xs leading-[1.55] text-muted">
                    <p>
                      Reviewed {formatDateTime(a.reviewed_at)}
                      {a.reviewer?.display_name ? ` by ${a.reviewer.display_name}` : ""}
                    </p>
                    {a.review_note && <p className="mt-1 whitespace-pre-wrap text-ink-soft">Review note: {a.review_note}</p>}
                  </div>
                )}
              </RecordRow>
            ))}
          </RecordList>
        )}

        <div className="border-t border-line">
          <Pagination
            page={page}
            totalPages={Math.ceil(total / PAGE_SIZE)}
            total={total}
            pageSize={PAGE_SIZE}
            noun={total === 1 ? "application" : "applications"}
            hrefFor={(p) => withParams("/admin/applications", { tab, q, page: p })}
          />
        </div>
      </Panel>
      <p className="mt-2 text-xs text-muted">
        Applicants are not emailed when rejected. Reviewed applications are deleted automatically 180 days after the decision.
      </p>
    </>
  );
}

/** Reject needs a note and approval may carry one; reviewApplication() enforces both on the server. */
function Decision({ id, name, requestedRole }: { id: string; name: string; requestedRole: string }) {
  const label = "block text-xs font-bold text-ink-soft";
  return (
    <ActionForm action={reviewApplication} className="w-full space-y-3 min-[761px]:w-[330px]">
      <input type="hidden" name="id" value={id} />
      <label className={label}>
        Role<span className="sr-only"> for {name}</span>
        <select name="role" defaultValue={requestedRole} className="field mt-[7px] min-h-9 py-1.5 text-[13px] font-normal">
          {APPLICATION_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Review note<span className="sr-only"> for {name}</span>
        <textarea name="note" rows={3} maxLength={1000} placeholder="Reason or onboarding note…" className="field mt-[7px] min-h-20 font-normal" />
        <span className="mt-1.5 block font-normal text-muted">Required to reject. Only staff can see it.</span>
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <SubmitButton name="decision" value="rejected" variant="outline" className={SMALL}>
          Reject
        </SubmitButton>
        <SubmitButton name="decision" value="approved" className={SMALL}>
          Approve &amp; invite
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
