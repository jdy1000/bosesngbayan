import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { TIP_STATUSES, type TipStatus } from "@/lib/tips";
import { safeLike } from "@/lib/studio/articles";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Empty, Notice, PageHeader, Pagination, Panel, RecordList, RecordMeta, RecordRow, RecordTitle, StatusBadge, Toolbar, ToolbarSearch, ToolbarTabs, withParams, type BadgeTone } from "@/components/studio/ui";
import { reviewTip } from "./actions";

export const metadata: Metadata = { title: "Tips" };

const PAGE_SIZE = 10; // as on Applications
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
// SubmitButton sets its own size, so the row size needs the important flag.
const SMALL = "!min-h-9 !px-3 !text-[13px]";

const TABS = [
  { key: "new", label: "New" },
  { key: "reviewing", label: "Reviewing" },
  { key: "verified", label: "Verified" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const STATUS: Record<TipStatus, { label: string; tone: BadgeTone }> = {
  new: { label: "New", tone: "amber" },
  reviewing: { label: "Reviewing", tone: "blue" },
  verified: { label: "Verified", tone: "green" },
  dismissed: { label: "Dismissed", tone: "red" },
};

/**
 * Tips from the public tip line (/mag-ulat, ADR-024). Private to tips.manage holders; nothing here is ever
 * published. Every status change goes through review_tip(), which re-checks the permission and audits it.
 */
export default async function TipsPage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireStaffPage("tips.manage");
  const sp = await searchParams;
  const tab: Tab = TABS.find((t) => t.key === one(sp.tab))?.key ?? "new";
  const q = one(sp.q).trim().slice(0, 120);
  const page = Math.min(10_000, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));

  const countFor = (status?: TipStatus) => {
    const c = ctx.supabase.from("tips").select("id", { count: "exact", head: true });
    return status ? c.eq("status", status) : c;
  };
  let query = ctx.supabase
    .from("tips")
    .select(
      "id, subject, details, agency, location, evidence_urls, contact_name, contact, status, staff_note, reviewed_at, created_at, updated_at, reviewer:profiles!tips_reviewed_by_fkey(display_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: tab === "new" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (tab !== "all") query = query.eq("status", tab);
  if (q) query = query.or(["subject", "details", "agency", "location"].map((c) => `${c}.ilike.${safeLike(q)}`).join(","));

  const [list, ...tallies] = await Promise.all([query, ...TIP_STATUSES.map((s) => countFor(s)), countFor()]);
  const counts = Object.fromEntries(TABS.map((t, i) => [t.key, tallies[i]?.count ?? null])) as Record<Tab, number | null>;
  const { data, count, error } = list;
  const total = count ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Investigations"
        title="Tips"
        description="Reports of suspected corruption sent through the public tip line. Tips are private and never published; verify before using any of it."
      />
      {one(sp.done) === "1" && (
        <div className="mb-6">
          <Notice tone="success">Tip updated.</Notice>
        </div>
      )}
      {one(sp.changed) === "1" && (
        <div className="mb-6">
          <Notice tone="warn">Not saved: someone else updated that tip while you had it open. The list now shows its current status; check it before changing it again.</Notice>
        </div>
      )}

      <Panel flush>
        <Toolbar>
          <ToolbarTabs
            label="Tip status"
            tabs={TABS.map((t) => ({
              key: t.key,
              label: (
                <>
                  {t.label}
                  <span className="font-normal tabular-nums opacity-75">{counts[t.key] ?? "–"}</span>
                </>
              ),
              href: withParams("/admin/tips", { tab: t.key, q }),
              current: tab === t.key,
            }))}
          />
          <ToolbarSearch action="/admin/tips" label="Search tips" placeholder="Search tips…" defaultValue={q} hidden={{ tab }} />
        </Toolbar>

        {error ? (
          <div className="px-[22px] py-5">
            <Notice tone="error">Could not load tips.</Notice>
          </div>
        ) : !data?.length ? (
          <Empty bare title="No tips found">
            {q || tab !== "all" ? "Try another search or status." : "Tips sent from the public tip line will appear here."}
          </Empty>
        ) : (
          <RecordList label="Tips">
            {data.map((tip) => (
              <RecordRow
                key={tip.id}
                actions={<Decision id={tip.id} subject={tip.subject} status={tip.status as TipStatus} note={tip.staff_note} updatedAt={tip.updated_at} tab={tab} />}
              >
                <RecordMeta>
                  <StatusBadge status={tip.status as TipStatus} map={STATUS} />
                  <span>Received {formatDateTime(tip.created_at)}</span>
                </RecordMeta>
                <RecordTitle>{tip.subject}</RecordTitle>
                {(tip.agency || tip.location) && (
                  <p className="text-[13px] text-ink-soft">{[tip.agency, tip.location].filter(Boolean).join(" · ")}</p>
                )}
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.55] text-ink-soft">{tip.details}</p>
                {tip.evidence_urls.length > 0 && (
                  <div className="mt-3 text-[13px]">
                    <p className="text-xs text-muted">Evidence links from the sender, unverified. Opening one shows your IP address to that site.</p>
                    <ul className="mt-1 space-y-1" aria-label="Evidence links">
                      {tip.evidence_urls.map((url, i) => (
                        <li key={i} className="break-all">
                          <EvidenceLink url={url} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-3 text-xs text-muted">
                  {tip.contact_name || tip.contact ? `Contact: ${[tip.contact_name, tip.contact].filter(Boolean).join(" · ")}` : "Anonymous (no contact left)"}
                </p>
                {tip.status !== "new" && (
                  <p className="mt-3 border-t border-line pt-3 text-xs leading-[1.55] text-muted">
                    Updated {formatDateTime(tip.reviewed_at)}
                    {tip.reviewer?.display_name ? ` by ${tip.reviewer.display_name}` : ""}
                  </p>
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
            noun={total === 1 ? "tip" : "tips"}
            hrefFor={(p) => withParams("/admin/tips", { tab, q, page: p })}
          />
        </div>
      </Panel>
      <p className="mt-2 text-xs text-muted">
        Senders are not notified of status changes. Dismissed tips are deleted automatically 180 days after dismissal.
      </p>
    </>
  );
}

/**
 * A link from the public, shown so its real destination is plain: the host in its ASCII (punycode) form,
 * then the encoded path, with any "user@" part removed. Lookalike or misleading links stay visible as such.
 */
function EvidenceLink({ url }: { url: string }) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return <span>{url}</span>;
  }
  if (u.protocol !== "https:") return <span>{url}</span>;
  u.username = "";
  u.password = "";
  return (
    // No referrer, no opener, no ranking signal.
    <a href={u.href} target="_blank" rel="noopener noreferrer nofollow" className="text-brand hover:underline">
      <strong>{u.host}</strong>
      {u.pathname === "/" && !u.search ? "" : `${u.pathname}${u.search}`}
      {u.hash} <span aria-hidden="true">↗</span>
    </a>
  );
}

/** Status and staff note. reviewTip() validates both; review_tip() requires a note to dismiss. */
function Decision({ id, subject, status, note, updatedAt, tab }: { id: string; subject: string; status: TipStatus; note: string | null; updatedAt: string; tab: Tab }) {
  const label = "block text-xs font-bold text-ink-soft";
  return (
    <ActionForm action={reviewTip} className="w-full space-y-3 min-[761px]:w-[330px]">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="updated_at" value={updatedAt} />
      <input type="hidden" name="tab" value={tab} />
      <label className={label}>
        Status<span className="sr-only"> for “{subject}”</span>
        <select name="status" defaultValue={status === "new" ? "reviewing" : status} className="field mt-[7px] min-h-9 py-1.5 text-[13px] font-normal">
          <option value="reviewing">Reviewing</option>
          <option value="verified">Verified</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </label>
      <label className={label}>
        Staff note<span className="sr-only"> for “{subject}”</span>
        <textarea name="note" rows={3} maxLength={2000} defaultValue={note ?? ""} placeholder="What was checked, who follows up…" className="field mt-[7px] min-h-20 font-normal" />
        <span className="mt-1.5 block font-normal text-muted">Required to dismiss. Only staff can see it.</span>
      </label>
      <div className="flex justify-end">
        <SubmitButton className={SMALL}>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
