import type { Metadata } from "next";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { Empty, PageHeader, Pagination, StatusBadge, Table, ARTICLE_STATUS, withParams } from "@/components/studio/ui";
import { formatDateTime, formatNumber } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { ARTICLE_SORTS, ARTICLE_STATUSES, listStudioArticles, loadEditorOptions, type ArticleSort, type ArticleStatus } from "@/lib/studio/articles";

export const metadata: Metadata = { title: "Articles" };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f-]{36}$/i;

export default async function ArticlesPage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireStaffPage();
  if (!ctx.permissions.has("articles.create") && !ctx.permissions.has("articles.view_all")) {
    return <Empty title="You don't have access to articles." />;
  }
  const sp = await searchParams;
  const status = ARTICLE_STATUSES.includes(one(sp.status) as ArticleStatus) ? (one(sp.status) as ArticleStatus) : undefined;
  const sort = (Object.hasOwn(ARTICLE_SORTS, one(sp.sort)) ? one(sp.sort) : "updated") as ArticleSort;
  const q = one(sp.q).slice(0, 80);
  const categoryId = UUID.test(one(sp.category)) ? one(sp.category) : undefined;
  const authorId = UUID.test(one(sp.author)) ? one(sp.author) : undefined;
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);

  const [list, options] = await Promise.all([listStudioArticles(ctx, { status, q, categoryId, authorId, sort, page }), loadEditorOptions(ctx)]);
  const params = { status, q, category: categoryId, author: authorId, sort };
  const showViews = list.views !== null;

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Articles"
        description="Manage stories through the full editorial workflow."
        actions={
          ctx.permissions.has("articles.create") && (
            <Link href="/admin/articles/new" className="btn btn-primary min-h-10 px-4 text-sm">
              + New article
            </Link>
          )
        }
      />

      <section className="rounded-2xl bg-paper shadow-card ring-1 ring-line">
        <div className="flex flex-col gap-3 border-b border-line px-4 pt-3 lg:flex-row lg:items-end lg:justify-between">
          <nav aria-label="Filter by status" className="-mb-px flex gap-1 overflow-x-auto">
            {[undefined, ...ARTICLE_STATUSES].map((s) => {
              const active = s === status;
              return (
                <Link
                  key={s ?? "all"}
                  href={withParams("/admin/articles", { ...params, status: s })}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold ${active ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink"}`}
                >
                  {s ? ARTICLE_STATUS[s]?.label : "All"}
                </Link>
              );
            })}
          </nav>
        </div>

        <form className="grid gap-2 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto]" role="search">
          {status && <input type="hidden" name="status" value={status} />}
          <input type="search" name="q" defaultValue={q} placeholder="Search title or slug…" aria-label="Search" className="field" />
          <select name="category" defaultValue={categoryId ?? ""} aria-label="Category" className="field">
            <option value="">All categories</option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="author" defaultValue={authorId ?? ""} aria-label="Author" className="field">
            <option value="">All authors</option>
            {options.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
          <select name="sort" defaultValue={sort} aria-label="Sort by" className="field">
            {Object.entries(ARTICLE_SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary min-h-10 px-4 text-sm">
            Search
          </button>
        </form>

        {list.rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold text-ink">{q || categoryId || authorId || status ? "No articles in this view." : "No articles yet."}</p>
            <p className="mt-1 text-sm text-muted">
              {q || categoryId || authorId || status
                ? "Choose another status or clear the search."
                : ctx.permissions.has("articles.create")
                  ? "Create the first draft with “New article”."
                  : "Articles you are credited on will appear here."}
            </p>
          </div>
        ) : (
          <Table
            plain
            head={["", "Title", "Category", "Author", "Status", "Published / Scheduled", "Last modified", ...(showViews ? ["Views"] : [])]}
          >
            {list.rows.map((a) => {
              const thumb = mediaUrl(a.image);
              return (
                <tr key={a.id} className="hover:bg-surface/60">
                  <td className="w-16">
                    <div className="flex h-10 w-14 items-center justify-center overflow-hidden rounded-md bg-surface-2">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Studio thumbnail; Supabase URL varies per environment
                        <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                      )}
                    </div>
                  </td>
                  <td className="max-w-[360px]">
                    <Link href={`/admin/articles/${a.id}`} className="font-semibold text-ink hover:text-brand">
                      {a.title}
                    </Link>
                    <p className="truncate font-mono text-xs text-muted">{a.slug}</p>
                  </td>
                  <td>{a.category?.name ?? <span className="text-muted">—</span>}</td>
                  <td className="min-w-36">{a.author?.display_name ?? "—"}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="whitespace-nowrap text-ink-soft">{a.published_at ? formatDateTime(a.published_at) : "—"}</td>
                  <td className="whitespace-nowrap text-ink-soft">{formatDateTime(a.updated_at)}</td>
                  {showViews && <td className="text-right tabular-nums">{formatNumber(list.views?.get(a.id) ?? 0)}</td>}
                </tr>
              );
            })}
          </Table>
        )}
        <div className="border-t border-line px-4 empty:hidden">
          <Pagination
            page={page}
            totalPages={list.totalPages}
            total={list.total}
            pageSize={list.pageSize}
            noun={list.total === 1 ? "article" : "articles"}
            hrefFor={(p) => withParams("/admin/articles", { ...params, page: p })}
          />
        </div>
      </section>
    </>
  );
}
