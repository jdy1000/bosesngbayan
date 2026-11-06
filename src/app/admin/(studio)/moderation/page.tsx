import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { COMMUNITY_KIND_LABELS, type CommunityKind } from "@/lib/cms/community";
import { formatDateTime, truncate } from "@/lib/format";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/report-reasons";
import { Badge, Empty, Notice, PageHeader, Pagination, StatusBadge, Table, withParams } from "@/components/studio/ui";
import { MODERATION_STATUS, MODERATION_STATUSES, REPORT_STATUS, REPORT_STATUSES } from "./labels";

export const metadata = { title: "Moderation" };

const PAGE_SIZE = 25;
const TABS = [
  { key: "posts", label: "Mga post" },
  { key: "comments", label: "Mga komento" },
  { key: "reports", label: "Mga ulat" },
] as const;
type Tab = (typeof TABS)[number]["key"];
type Search = Record<string, string | undefined>;

const like = (q: string) => `%${q.replace(/[%_,()]/g, " ")}%`;
const pick = <T extends string>(list: readonly T[], v: string | undefined): T | undefined => list.find((x) => x === v);

export default async function ModerationPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireStaffPage("moderation.manage");
  const sp = await searchParams;
  const tab: Tab = pick(["posts", "comments", "reports"], sp.tab) ?? "posts";

  const [pendingPosts, pendingComments, openReports] = await Promise.all([
    ctx.supabase.from("community_posts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ctx.supabase.from("comments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ctx.supabase.from("moderation_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const counts: Record<Tab, number | null> = { posts: pendingPosts.count, comments: pendingComments.count, reports: openReports.count };

  return (
    <>
      <PageHeader title="Moderation" description="Suriin ang mga isinumite ng komunidad, mga komento at mga ulat bago o pagkatapos lumabas sa publiko." />
      <nav aria-label="Mga queue" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={withParams("/admin/moderation", { tab: t.key })}
            aria-current={tab === t.key ? "page" : undefined}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${tab === t.key ? "bg-navy text-white" : "border border-line bg-white text-ink-soft hover:border-brand"}`}
          >
            {t.label}
            {counts[t.key] ? <span className="rounded-full bg-accent px-2 text-xs text-white tabular-nums">{counts[t.key]}</span> : null}
          </Link>
        ))}
      </nav>
      {tab === "posts" && <PostsQueue sp={sp} ctx={ctx} />}
      {tab === "comments" && <CommentsQueue sp={sp} ctx={ctx} />}
      {tab === "reports" && <ReportsQueue sp={sp} ctx={ctx} />}
    </>
  );
}

type Ctx = Awaited<ReturnType<typeof requireStaffPage>>;

function Filters({ tab, q, children }: { tab: Tab; q?: string; children: React.ReactNode }) {
  return (
    <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
      <input type="hidden" name="tab" value={tab} />
      {q !== undefined && (
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="sr-only">
            Hanapin
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Hanapin ang teksto o pangalan…" className="field" />
        </div>
      )}
      {children}
      <button type="submit" className="btn btn-outline min-h-11 px-4 text-sm">
        I-filter
      </button>
    </form>
  );
}

function StatusSelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label htmlFor="status" className="sr-only">
        Status
      </label>
      <select id="status" name="status" defaultValue={value} className="field">
        <option value="all">Lahat ng status</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const statusOptions = MODERATION_STATUSES.map((s) => ({ value: s, label: MODERATION_STATUS[s].label }));

async function PostsQueue({ sp, ctx }: { sp: Search; ctx: Ctx }) {
  const status = sp.status === "all" ? undefined : (pick(MODERATION_STATUSES, sp.status) ?? "pending");
  const kind = pick(Object.keys(COMMUNITY_KIND_LABELS) as CommunityKind[], sp.kind);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  let query = ctx.supabase
    .from("community_posts")
    .select("id, kind, title, author_name, status, is_featured, created_at, reports:moderation_reports(count)", { count: "exact" })
    .order("created_at", { ascending: status === "pending" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (kind) query = query.eq("kind", kind);
  if (q) query = query.or(`title.ilike.${like(q)},body.ilike.${like(q)},author_name.ilike.${like(q)}`);
  const { data, count, error } = await query;

  return (
    <>
      <Filters tab="posts" q={q}>
        <StatusSelect value={status ?? "all"} options={statusOptions} />
        <div>
          <label htmlFor="kind" className="sr-only">
            Uri
          </label>
          <select id="kind" name="kind" defaultValue={kind ?? ""} className="field">
            <option value="">Lahat ng uri</option>
            {Object.entries(COMMUNITY_KIND_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </Filters>
      {error ? (
        <Notice tone="error">Hindi makuha ang mga post.</Notice>
      ) : !data?.length ? (
        <Empty title={status === "pending" ? "Walang naghihintay na post" : "Walang tumugmang post"}>Malinis ang queue na ito.</Empty>
      ) : (
        <>
          <Table head={["Post", "Uri", "May-akda", "Status", "Mga ulat", "Isinumite"]}>
            {data.map((p) => (
              <tr key={p.id}>
                <td className="max-w-md">
                  <Link href={`/admin/moderation/posts/${p.id}`} className="font-semibold text-ink hover:text-brand">
                    {p.title}
                  </Link>
                </td>
                <td className="text-ink-soft">{COMMUNITY_KIND_LABELS[p.kind]}</td>
                <td className="text-ink-soft">{p.author_name}</td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge status={p.status} map={MODERATION_STATUS} />
                    {p.is_featured && <Badge tone="navy">Featured</Badge>}
                  </div>
                </td>
                <td className="tabular-nums">{p.reports[0]?.count ?? 0}</td>
                <td className="text-xs text-ink-soft">{formatDateTime(p.created_at)}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} totalPages={Math.ceil((count ?? 0) / PAGE_SIZE)} hrefFor={(n) => withParams("/admin/moderation", { tab: "posts", q, status: status ?? "all", kind, page: n })} />
        </>
      )}
    </>
  );
}

async function CommentsQueue({ sp, ctx }: { sp: Search; ctx: Ctx }) {
  const status = sp.status === "all" ? undefined : (pick(MODERATION_STATUSES, sp.status) ?? "pending");
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  let query = ctx.supabase
    .from("comments")
    .select("id, body, author_name, status, created_at, article:articles(title), post:community_posts(title), reports:moderation_reports(count)", { count: "exact" })
    .order("created_at", { ascending: status === "pending" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const post = /^[0-9a-f-]{36}$/.test(sp.post ?? "") ? sp.post : undefined;
  if (status) query = query.eq("status", status);
  if (post) query = query.eq("community_post_id", post);
  if (q) query = query.or(`body.ilike.${like(q)},author_name.ilike.${like(q)}`);
  const { data, count, error } = await query;

  return (
    <>
      <Filters tab="comments" q={q}>
        {post && <input type="hidden" name="post" value={post} />}
        <StatusSelect value={status ?? "all"} options={statusOptions} />
      </Filters>
      {error ? (
        <Notice tone="error">Hindi makuha ang mga komento.</Notice>
      ) : !data?.length ? (
        <Empty title={status === "pending" ? "Walang naghihintay na komento" : "Walang tumugmang komento"}>Malinis ang queue na ito.</Empty>
      ) : (
        <>
          <Table head={["Komento", "Sa", "May-akda", "Status", "Mga ulat", "Isinumite"]}>
            {data.map((c) => (
              <tr key={c.id}>
                <td className="max-w-md">
                  <Link href={`/admin/moderation/comments/${c.id}`} className="text-ink hover:text-brand">
                    {truncate(c.body, 140)}
                  </Link>
                </td>
                <td className="max-w-48 text-xs text-ink-soft">{c.article?.title ?? c.post?.title ?? "—"}</td>
                <td className="text-ink-soft">{c.author_name}</td>
                <td>
                  <StatusBadge status={c.status} map={MODERATION_STATUS} />
                </td>
                <td className="tabular-nums">{c.reports[0]?.count ?? 0}</td>
                <td className="text-xs text-ink-soft">{formatDateTime(c.created_at)}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} totalPages={Math.ceil((count ?? 0) / PAGE_SIZE)} hrefFor={(n) => withParams("/admin/moderation", { tab: "comments", q, status: status ?? "all", post, page: n })} />
        </>
      )}
    </>
  );
}

async function ReportsQueue({ sp, ctx }: { sp: Search; ctx: Ctx }) {
  const status = sp.status === "all" ? undefined : (pick(REPORT_STATUSES, sp.status) ?? "open");
  const reason = pick(REPORT_REASONS, sp.reason);
  const page = Math.max(1, Number(sp.page) || 1);
  let query = ctx.supabase
    .from("moderation_reports")
    .select("id, reason, details, status, created_at, community_post_id, comment_id, post:community_posts(title), comment:comments(body)", { count: "exact" })
    .order("created_at", { ascending: status === "open" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (reason) query = query.eq("reason", reason);
  const { data, count, error } = await query;

  return (
    <>
      <Filters tab="reports">
        <StatusSelect value={status ?? "all"} options={REPORT_STATUSES.map((s) => ({ value: s, label: REPORT_STATUS[s].label }))} />
        <div>
          <label htmlFor="reason" className="sr-only">
            Dahilan
          </label>
          <select id="reason" name="reason" defaultValue={reason ?? ""} className="field">
            <option value="">Lahat ng dahilan</option>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {REPORT_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      </Filters>
      {error ? (
        <Notice tone="error">Hindi makuha ang mga ulat.</Notice>
      ) : !data?.length ? (
        <Empty title={status === "open" ? "Walang bukas na ulat" : "Walang tumugmang ulat"}>Ang mga ulat mula sa publiko ay lalabas dito.</Empty>
      ) : (
        <>
          <Table head={["Dahilan", "Tinutukoy", "Detalye", "Status", "Iniulat"]}>
            {data.map((r) => {
              const href = r.community_post_id ? `/admin/moderation/posts/${r.community_post_id}` : `/admin/moderation/comments/${r.comment_id}`;
              const target = r.post?.title ?? (r.comment ? `Komento: ${truncate(r.comment.body, 80)}` : "—");
              return (
                <tr key={r.id}>
                  <td className="font-semibold">{REPORT_REASON_LABELS[r.reason]}</td>
                  <td className="max-w-sm">
                    <Link href={href} className="text-ink hover:text-brand">
                      {target}
                    </Link>
                  </td>
                  <td className="max-w-xs text-xs text-ink-soft">{r.details ? truncate(r.details, 120) : "—"}</td>
                  <td>
                    <StatusBadge status={r.status} map={REPORT_STATUS} />
                  </td>
                  <td className="text-xs text-ink-soft">{formatDateTime(r.created_at)}</td>
                </tr>
              );
            })}
          </Table>
          <Pagination page={page} totalPages={Math.ceil((count ?? 0) / PAGE_SIZE)} hrefFor={(n) => withParams("/admin/moderation", { tab: "reports", status: status ?? "all", reason, page: n })} />
        </>
      )}
    </>
  );
}
