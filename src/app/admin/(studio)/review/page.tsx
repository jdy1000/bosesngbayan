import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { Empty, Notice, PageHeader, Pagination, Panel, RecordList, RecordMeta, RecordRow, RecordTitle, Toolbar, ToolbarSearch, withParams } from "@/components/studio/ui";
import { formatDateTime } from "@/lib/format";
import { safeLike } from "@/lib/studio/articles";
import { ReviewActions } from "./review-actions";

export const metadata: Metadata = { title: "Review queue" };

const PAGE_SIZE = 10; // as in the Newsmaker console
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** What the banner says after a decision. The key comes from the URL, so only these fixed texts can be shown. */
const NOTICES: Record<string, string> = {
  approved: "Article approved.",
  published: "Article approved and published.",
  returned: "Article returned to its author.",
};

interface QueueRow {
  id: string;
  title: string;
  excerpt: string | null;
  submitted_at: string | null;
  category: { name: string } | null;
  author: { display_name: string } | null;
}

/** Articles waiting for an editor, oldest submission first. Every action re-checks permissions in transition_article(). */
export default async function ReviewQueuePage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireStaffPage("articles.review");
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 120);
  const page = Math.min(10_000, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));
  const from = (page - 1) * PAGE_SIZE;
  const notice = NOTICES[one(sp.notice)];

  let query = ctx.supabase
    .from("articles")
    .select(
      `id, title, excerpt, submitted_at,
       category:categories!articles_category_id_fkey(name),
       author:profiles!articles_author_id_fkey(display_name)`,
      { count: "exact" },
    )
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("id");
  if (q) query = query.ilike("title", safeLike(q));
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  const rows = (data ?? []) as unknown as QueueRow[];
  const total = count ?? 0;
  const canPublish = ctx.permissions.has("articles.publish");

  return (
    <>
      <PageHeader
        eyebrow="Editorial workflow"
        title="Review queue"
        description="Review submitted stories before publication."
        actions={
          <Link href="/admin/articles" className="btn btn-outline">
            All articles
          </Link>
        }
      />
      {notice && (
        <div className="mb-6">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}

      <Panel flush>
        <Toolbar>
          <p className="text-sm font-semibold text-ink">
            <span className="tabular-nums">{total}</span> awaiting review
          </p>
          <ToolbarSearch action="/admin/review" label="Search submitted stories" placeholder="Search submitted stories…" defaultValue={q} />
        </Toolbar>

        {rows.length === 0 ? (
          <Empty bare title="Review queue is clear">
            {q ? "No submitted stories match your search." : "Submitted stories will appear here."}
          </Empty>
        ) : (
          <RecordList label="Stories awaiting review">
            {rows.map((a) => (
              <RecordRow key={a.id} actions={<ReviewActions articleId={a.id} title={a.title} canPublish={canPublish} />}>
                <RecordMeta>
                  <span className="font-bold uppercase tracking-[0.35px] text-brand-700">{a.category?.name ?? "No category"}</span>
                  <span>Submitted {formatDateTime(a.submitted_at)}</span>
                </RecordMeta>
                <RecordTitle>{a.title}</RecordTitle>
                {a.excerpt && <p className="line-clamp-3 text-[15px] leading-[1.55] text-ink-soft">{a.excerpt}</p>}
                <p className="mt-2 text-xs text-muted">By {a.author?.display_name ?? "Unknown author"}</p>
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-bold">
                  <Link href={`/admin/articles/${a.id}`} className="text-brand hover:underline">
                    Open article
                  </Link>
                  <Link href={`/admin/preview/articles/${a.id}`} target="_blank" className="text-brand hover:underline">
                    Preview <span aria-hidden="true">↗</span>
                  </Link>
                </p>
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
            noun={total === 1 ? "article" : "articles"}
            hrefFor={(p) => withParams("/admin/review", { q, page: p })}
          />
        </div>
      </Panel>
    </>
  );
}
