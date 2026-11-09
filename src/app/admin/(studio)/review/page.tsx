import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { PageHeader, Pagination, withParams } from "@/components/studio/ui";
import { formatDateTime } from "@/lib/format";
import { safeLike } from "@/lib/studio/articles";
import { ReviewActions } from "./review-actions";

export const metadata: Metadata = { title: "Review queue" };

const PAGE_SIZE = 20;
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

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
  const q = one(sp.q).trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

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
      <PageHeader eyebrow="Editorial workflow" title="Review queue" description="Review submitted stories before publication." />

      <section className="rounded-2xl bg-paper shadow-card ring-1 ring-line">
        <form role="search" className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <p className="text-sm font-semibold text-ink">
            <span className="tabular-nums">{total}</span> waiting for review
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <input type="search" name="q" defaultValue={q} placeholder="Search titles…" aria-label="Search titles" className="field sm:w-72" />
            <button type="submit" className="btn btn-primary min-h-10 px-4 text-sm">
              Search
            </button>
          </div>
        </form>

        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold text-ink">{q ? "No submitted stories match that title." : "You’re all caught up."}</p>
            <p className="mt-1 text-sm text-muted">{q ? "Clear the search to see the whole queue." : "Nothing is waiting for review right now."}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((a) => (
              <li key={a.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
                <div className="min-w-0">
                  <Link href={`/admin/articles/${a.id}`} className="text-base font-semibold text-ink hover:text-brand">
                    {a.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {a.author?.display_name ?? "Unknown author"} · {a.category?.name ?? "No category"} · Submitted {formatDateTime(a.submitted_at)}
                  </p>
                  {a.excerpt && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{a.excerpt}</p>}
                  <p className="mt-2 flex gap-4 text-sm font-semibold">
                    <Link href={`/admin/articles/${a.id}`} className="text-brand hover:underline">
                      Open in editor
                    </Link>
                    <Link href={`/admin/preview/articles/${a.id}`} target="_blank" className="text-brand hover:underline">
                      Preview
                    </Link>
                  </p>
                </div>
                <ReviewActions articleId={a.id} title={a.title} canPublish={canPublish} />
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-line px-4 empty:hidden">
          <Pagination
            page={page}
            totalPages={Math.ceil(total / PAGE_SIZE)}
            total={total}
            pageSize={PAGE_SIZE}
            noun={total === 1 ? "story" : "stories"}
            hrefFor={(p) => withParams("/admin/review", { q, page: p })}
          />
        </div>
      </section>
    </>
  );
}
