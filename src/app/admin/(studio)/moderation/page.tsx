import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffPage, type StaffContext } from "@/lib/auth/session";
import { COMMUNITY_KIND_LABELS, COMMUNITY_KINDS } from "@/lib/cms/community";
import { formatDateTime, truncate } from "@/lib/format";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/report-reasons";
import { safeLike } from "@/lib/studio/articles";
import { Badge, Empty, Notice, PageHeader, Pagination, Panel, RecordList, RecordRow, StatusBadge, Table, Toolbar, ToolbarSearch, ToolbarTabs, withParams } from "@/components/studio/ui";
import { MODERATION_STATUS, MODERATION_STATUSES, REPORT_STATUS, REPORT_STATUSES, type ModerationStatus } from "./labels";
import { ReportForm, ReportSummary } from "./parts";

export const metadata = { title: "Moderation" };

const BASE = "/admin/moderation";
const REPORTS_PAGE_SIZE = 10; // as in the Newsmaker console
const QUEUE_PAGE_SIZE = 25;
const SECTIONS = [
  { key: "reports", label: "Reports" },
  { key: "posts", label: "Community posts" },
  { key: "comments", label: "Comments" },
] as const;
type Section = (typeof SECTIONS)[number]["key"];
type Search = Record<string, string>;
type Params = Record<string, string | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pick = <T extends string>(list: readonly T[], v: string | undefined): T | undefined => list.find((x) => x === v);
const pageOf = (v: string | undefined) => Math.min(10_000, Math.max(1, Number.parseInt(v ?? "", 10) || 1));
const FILTER_SELECT = "field min-h-9 w-auto py-1.5 text-[13px]";

/**
 * Report inbox in the Newsmaker console's shape (ADR-021): status tabs and search share one toolbar and each
 * report is updated in place. Community posts and comments are Boses additions and keep their own queues.
 * Every change goes through resolve_report() / moderate_content(), which re-check moderation.manage.
 */
export default async function ModerationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireStaffPage("moderation.manage");
  const sp: Search = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, one(v)]));
  const section: Section = pick(SECTIONS.map((s) => s.key), sp.tab) ?? "reports";

  const head = { count: "exact" as const, head: true };
  const [activeReports, pendingPosts, pendingComments] = await Promise.all([
    ctx.supabase.from("moderation_reports").select("id", head).in("status", ["open", "reviewing"]),
    ctx.supabase.from("community_posts").select("id", head).eq("status", "pending"),
    ctx.supabase.from("comments").select("id", head).eq("status", "pending"),
  ]);
  const waiting: Record<Section, number | null> = { reports: activeReports.count, posts: pendingPosts.count, comments: pendingComments.count };

  return (
    <>
      <PageHeader eyebrow="Trust and corrections" title="Report inbox" description="Review reader reports, submissions and comments, and record each resolution." />
      <div className="mb-3.5">
        <ToolbarTabs
          label="Moderation sections"
          tabs={SECTIONS.map((s) => ({
            key: s.key,
            href: withParams(BASE, { tab: s.key }),
            current: s.key === section,
            label: (
              <>
                {s.label}
                {waiting[s.key] ? (
                  <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold leading-4 tabular-nums text-white">
                    {waiting[s.key]}
                    <span className="sr-only"> waiting</span>
                  </span>
                ) : null}
              </>
            ),
          }))}
        />
      </div>
      {section === "reports" && <ReportsView sp={sp} ctx={ctx} />}
      {section === "posts" && <PostsView sp={sp} ctx={ctx} />}
      {section === "comments" && <CommentsView sp={sp} ctx={ctx} />}
    </>
  );
}

/** Sends a page number past the last page back into range (a stale link, or rows that left the filter). */
function keepInRange(page: number, total: number, pageSize: number, error: { code?: string } | null, params: Params) {
  if (page === 1) return;
  // PostgREST answers an offset beyond the last row with PGRST103 instead of an empty page.
  if (error?.code === "PGRST103") redirect(withParams(BASE, params));
  const last = Math.ceil(total / pageSize);
  if (!error && page > last) redirect(withParams(BASE, { ...params, page: last > 1 ? String(last) : undefined }));
}

/** Secondary GET filter under the toolbar (a Boses addition, as on the Articles page). `keep` carries the other params. */
function FilterRow({ keep, clearHref, children }: { keep: Params; clearHref?: string; children: React.ReactNode }) {
  return (
    <form method="get" action={BASE} className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-2.5">
      {Object.entries(keep).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <span className="mr-1 text-xs font-bold text-ink-soft">Filter</span>
      {children}
      <button type="submit" className="btn btn-outline min-h-9 px-3 text-[13px]">
        Apply
      </button>
      {clearHref && (
        <Link href={clearHref} className="px-1 text-xs font-bold text-brand hover:underline">
          Clear filter
        </Link>
      )}
    </form>
  );
}

function ListFooter({ page, total, pageSize, nouns, params }: { page: number; total: number; pageSize: number; nouns: [string, string]; params: Params }) {
  return (
    <div className="border-t border-line">
      <Pagination
        page={page}
        totalPages={Math.ceil(total / pageSize)}
        total={total}
        pageSize={pageSize}
        noun={total === 1 ? nouns[0] : nouns[1]}
        hrefFor={(p) => withParams(BASE, { ...params, page: p })}
      />
    </div>
  );
}

function LoadError({ what }: { what: string }) {
  return (
    <div className="p-5">
      <Notice tone="error">Could not load {what}.</Notice>
    </div>
  );
}

async function ReportsView({ sp, ctx }: { sp: Search; ctx: StaffContext }) {
  const status = pick(REPORT_STATUSES, sp.status);
  const reason = pick(REPORT_REASONS, sp.reason);
  const q = (sp.q ?? "").trim().slice(0, 120);
  const page = pageOf(sp.page);
  const from = (page - 1) * REPORTS_PAGE_SIZE;
  const params: Params = { tab: "reports", status, reason, q };

  let query = ctx.supabase
    .from("moderation_reports")
    .select("id, reason, details, status, resolution_note, resolved_at, created_at, community_post_id, comment_id, post:community_posts(title), comment:comments(body)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .order("id");
  if (status) query = query.eq("status", status);
  if (reason) query = query.eq("reason", reason);
  if (q) query = query.ilike("details", safeLike(q));
  const { data, count, error } = await query.range(from, from + REPORTS_PAGE_SIZE - 1);
  const total = count ?? 0;
  keepInRange(page, total, REPORTS_PAGE_SIZE, error, params);

  return (
    <Panel flush>
      <Toolbar>
        <ToolbarTabs
          label="Report status"
          tabs={[undefined, ...REPORT_STATUSES].map((s) => ({
            key: s ?? "all",
            label: s ? REPORT_STATUS[s].label : "All",
            href: withParams(BASE, { ...params, status: s }),
            current: s === status,
          }))}
        />
        <ToolbarSearch action={BASE} label="Search reports" placeholder="Search reports…" defaultValue={q} hidden={{ tab: "reports", status, reason }} />
      </Toolbar>
      <FilterRow keep={{ tab: "reports", status, q }} clearHref={reason ? withParams(BASE, { ...params, reason: undefined }) : undefined}>
        <select name="reason" defaultValue={reason ?? ""} aria-label="Reason" className={FILTER_SELECT}>
          <option value="">All reasons</option>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {REPORT_REASON_LABELS.en[r]}
            </option>
          ))}
        </select>
      </FilterRow>

      {error ? (
        <LoadError what="reports" />
      ) : !data?.length ? (
        <Empty bare title="No reports found">
          {q || status || reason ? "Try another search or status." : "Reader reports will appear here."}
        </Empty>
      ) : (
        <RecordList label="Reader reports">
          {data.map((r) => {
            const href = r.community_post_id ? `${BASE}/posts/${r.community_post_id}` : `${BASE}/comments/${r.comment_id}`;
            const target = r.post ? `Reported post: ${r.post.title}` : r.comment ? `Reported comment: ${truncate(r.comment.body, 80)}` : "Open reported item";
            return (
              <RecordRow key={r.id} actions={<ReportForm report={r} className="min-[761px]:w-[330px]" />}>
                <ReportSummary report={r} />
                <p className="mt-3 text-[13px] font-bold">
                  <Link href={href} className="break-words text-brand hover:underline">
                    {target}
                  </Link>
                </p>
              </RecordRow>
            );
          })}
        </RecordList>
      )}
      {!error && <ListFooter page={page} total={total} pageSize={REPORTS_PAGE_SIZE} nouns={["report", "reports"]} params={params} />}
    </Panel>
  );
}

/** Status tabs + search shared by the posts and comments queues. No status param means the pending queue. */
function QueueToolbar({ tab, noun, status, q, keep }: { tab: Section; noun: string; status: ModerationStatus | undefined; q: string; keep?: Params }) {
  return (
    <Toolbar>
      <ToolbarTabs
        label={`${noun} status`}
        tabs={[undefined, ...MODERATION_STATUSES].map((s) => ({
          key: s ?? "all",
          label: s ? MODERATION_STATUS[s].label : "All",
          href: withParams(BASE, { tab, ...keep, q, status: s ?? "all" }),
          current: s === status,
        }))}
      />
      <ToolbarSearch action={BASE} label={`Search ${noun.toLowerCase()}s`} placeholder="Search text or name…" defaultValue={q} hidden={{ tab, status: status ?? "all", ...keep }} />
    </Toolbar>
  );
}

async function PostsView({ sp, ctx }: { sp: Search; ctx: StaffContext }) {
  const status = sp.status === "all" ? undefined : (pick(MODERATION_STATUSES, sp.status) ?? "pending");
  const kind = pick(COMMUNITY_KINDS, sp.kind);
  const q = (sp.q ?? "").trim().slice(0, 120);
  const page = pageOf(sp.page);
  const from = (page - 1) * QUEUE_PAGE_SIZE;
  const params: Params = { tab: "posts", status: status ?? "all", kind, q };

  let query = ctx.supabase
    .from("community_posts")
    .select("id, kind, title, author_name, status, is_featured, created_at, reports:moderation_reports(count)", { count: "exact" })
    .order("created_at", { ascending: status === "pending" })
    .order("id");
  if (status) query = query.eq("status", status);
  if (kind) query = query.eq("kind", kind);
  if (q) {
    const like = safeLike(q);
    query = query.or(`title.ilike.${like},body.ilike.${like},author_name.ilike.${like}`);
  }
  const { data, count, error } = await query.range(from, from + QUEUE_PAGE_SIZE - 1);
  const total = count ?? 0;
  keepInRange(page, total, QUEUE_PAGE_SIZE, error, params);

  return (
    <Panel flush>
      <QueueToolbar tab="posts" noun="Post" status={status} q={q} keep={{ kind }} />
      <FilterRow keep={{ tab: "posts", status: status ?? "all", q }} clearHref={kind ? withParams(BASE, { ...params, kind: undefined }) : undefined}>
        <select name="kind" defaultValue={kind ?? ""} aria-label="Type" className={FILTER_SELECT}>
          <option value="">All types</option>
          {COMMUNITY_KINDS.map((k) => (
            <option key={k} value={k}>
              {COMMUNITY_KIND_LABELS.en[k]}
            </option>
          ))}
        </select>
      </FilterRow>

      {error ? (
        <LoadError what="posts" />
      ) : !data?.length ? (
        <Empty bare title={status === "pending" ? "No pending posts" : "No matching posts"}>
          This queue is clear.
        </Empty>
      ) : (
        <Table plain head={["Post", "Type", "Author", "Status", "Reports", "Submitted"]}>
          {data.map((p) => (
            <tr key={p.id} className="transition-colors hover:bg-surface">
              <td className="min-w-[240px] max-w-md">
                <Link href={`${BASE}/posts/${p.id}`} className="font-semibold text-ink hover:text-brand">
                  {p.title}
                </Link>
              </td>
              <td className="text-ink-soft">{COMMUNITY_KIND_LABELS.en[p.kind]}</td>
              <td className="text-ink-soft">{p.author_name}</td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status={p.status} map={MODERATION_STATUS} />
                  {p.is_featured && <Badge tone="navy">Featured</Badge>}
                </div>
              </td>
              <td className="tabular-nums">{p.reports[0]?.count ?? 0}</td>
              <td className="whitespace-nowrap text-ink-soft">{formatDateTime(p.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
      {!error && <ListFooter page={page} total={total} pageSize={QUEUE_PAGE_SIZE} nouns={["post", "posts"]} params={params} />}
    </Panel>
  );
}

async function CommentsView({ sp, ctx }: { sp: Search; ctx: StaffContext }) {
  const status = sp.status === "all" ? undefined : (pick(MODERATION_STATUSES, sp.status) ?? "pending");
  const post = /^[0-9a-f-]{36}$/.test(sp.post ?? "") ? sp.post : undefined;
  const q = (sp.q ?? "").trim().slice(0, 120);
  const page = pageOf(sp.page);
  const from = (page - 1) * QUEUE_PAGE_SIZE;
  const params: Params = { tab: "comments", status: status ?? "all", post, q };

  let query = ctx.supabase
    .from("comments")
    .select("id, body, author_name, status, created_at, article:articles(title), post:community_posts(title), reports:moderation_reports(count)", { count: "exact" })
    .order("created_at", { ascending: status === "pending" })
    .order("id");
  if (status) query = query.eq("status", status);
  if (post) query = query.eq("community_post_id", post);
  if (q) {
    const like = safeLike(q);
    query = query.or(`body.ilike.${like},author_name.ilike.${like}`);
  }
  const { data, count, error } = await query.range(from, from + QUEUE_PAGE_SIZE - 1);
  const total = count ?? 0;
  keepInRange(page, total, QUEUE_PAGE_SIZE, error, params);

  return (
    <Panel flush>
      <QueueToolbar tab="comments" noun="Comment" status={status} q={q} keep={{ post }} />
      {post && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-5 py-2.5 text-xs text-ink-soft">
          Showing comments on one community post.
          <Link href={withParams(BASE, { ...params, post: undefined })} className="font-bold text-brand hover:underline">
            Show all comments
          </Link>
        </p>
      )}

      {error ? (
        <LoadError what="comments" />
      ) : !data?.length ? (
        <Empty bare title={status === "pending" ? "No pending comments" : "No matching comments"}>
          This queue is clear.
        </Empty>
      ) : (
        <Table plain head={["Comment", "On", "Author", "Status", "Reports", "Submitted"]}>
          {data.map((c) => (
            <tr key={c.id} className="transition-colors hover:bg-surface">
              <td className="min-w-[240px] max-w-md">
                <Link href={`${BASE}/comments/${c.id}`} className="text-ink hover:text-brand">
                  {truncate(c.body, 140)}
                </Link>
              </td>
              <td className="max-w-48 text-ink-soft">{c.article?.title ?? c.post?.title ?? "—"}</td>
              <td className="text-ink-soft">{c.author_name}</td>
              <td>
                <StatusBadge status={c.status} map={MODERATION_STATUS} />
              </td>
              <td className="tabular-nums">{c.reports[0]?.count ?? 0}</td>
              <td className="whitespace-nowrap text-ink-soft">{formatDateTime(c.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
      {!error && <ListFooter page={page} total={total} pageSize={QUEUE_PAGE_SIZE} nouns={["comment", "comments"]} params={params} />}
    </Panel>
  );
}
