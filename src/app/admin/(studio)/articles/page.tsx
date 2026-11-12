import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { ARTICLE_STATUS, Empty, PageHeader, Pagination, Panel, StatusBadge, Table, Toolbar, ToolbarSearch, ToolbarTabs, withParams } from "@/components/studio/ui";
import { formatDateTime, formatNumber } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { ARTICLE_SORTS, ARTICLE_STATUSES, listStudioArticles, loadEditorOptions, type ArticleSort, type ArticleStatus } from "@/lib/studio/articles";

export const metadata: Metadata = { title: "Articles" };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f-]{36}$/i;
const MAX_PAGE = 10_000;

/**
 * Article list in the Newsmaker console's shape (ADR-021): status tabs and search share one toolbar, each row
 * leads with the story and ends with Edit. The category, author and sort filters are Boses additions.
 */
export default async function ArticlesPage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireStaffPage();
  if (!ctx.permissions.has("articles.create") && !ctx.permissions.has("articles.view_all")) {
    return <Empty title="You don't have access to articles." />;
  }
  const sp = await searchParams;
  const status = ARTICLE_STATUSES.includes(one(sp.status) as ArticleStatus) ? (one(sp.status) as ArticleStatus) : undefined;
  const sort = (Object.hasOwn(ARTICLE_SORTS, one(sp.sort)) ? one(sp.sort) : "updated") as ArticleSort;
  const q = one(sp.q).slice(0, 120);
  const categoryId = UUID.test(one(sp.category)) ? one(sp.category) : undefined;
  const authorId = UUID.test(one(sp.author)) ? one(sp.author) : undefined;
  const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));

  const [list, options] = await Promise.all([listStudioArticles(ctx, { status, q, categoryId, authorId, sort, page }), loadEditorOptions(ctx)]);
  const params = { status, q, category: categoryId, author: authorId, sort: sort === "updated" ? undefined : sort };
  // A page past the end (a stale link, or rows removed since) goes to the last page instead of an empty table.
  if (list.total > 0 && page > list.totalPages) redirect(withParams("/admin/articles", { ...params, page: list.totalPages }));
  const showViews = list.views !== null;
  const filtered = Boolean(q || categoryId || authorId);

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Articles"
        description="Manage stories through the full editorial workflow."
        actions={
          ctx.permissions.has("articles.create") && (
            <Link href="/admin/articles/new" className="btn btn-primary">
              <span aria-hidden="true">+</span> Create article
            </Link>
          )
        }
      />

      <Panel flush>
        <Toolbar>
          <ToolbarTabs
            label="Article status"
            tabs={[undefined, ...ARTICLE_STATUSES].map((s) => ({
              key: s ?? "all",
              label: s ? ARTICLE_STATUS[s]?.label : "All",
              href: withParams("/admin/articles", { ...params, status: s }),
              current: s === status,
            }))}
          />
          <ToolbarSearch
            action="/admin/articles"
            label="Search articles by title or slug"
            placeholder="Search title or slug…"
            defaultValue={q}
            hidden={{ status, category: categoryId, author: authorId, sort: params.sort }}
          />
        </Toolbar>

        <form method="get" action="/admin/articles" className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-2.5">
          {status && <input type="hidden" name="status" value={status} />}
          {q && <input type="hidden" name="q" value={q} />}
          <span className="mr-1 text-xs font-bold text-ink-soft">Filter</span>
          <select name="category" defaultValue={categoryId ?? ""} aria-label="Category" className="field min-h-9 w-auto py-1.5 text-[13px]">
            <option value="">All categories</option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="author" defaultValue={authorId ?? ""} aria-label="Author" className="field min-h-9 w-auto py-1.5 text-[13px]">
            <option value="">All authors</option>
            {options.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
          <select name="sort" defaultValue={sort} aria-label="Sort by" className="field min-h-9 w-auto py-1.5 text-[13px]">
            {Object.entries(ARTICLE_SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-outline min-h-9 px-3 text-[13px]">
            Apply
          </button>
          {(categoryId || authorId || sort !== "updated") && (
            <Link href={withParams("/admin/articles", { status, q })} className="px-1 text-xs font-bold text-brand hover:underline">
              Clear filters
            </Link>
          )}
        </form>

        {list.rows.length === 0 ? (
          <Empty bare title={filtered ? "No matching articles" : "No articles in this view"}>
            {filtered
              ? "Try another title, filter or status."
              : ctx.permissions.has("articles.create")
                ? "Choose another status or create a story."
                : "Articles you are credited on will appear here."}
          </Empty>
        ) : (
          <Table plain head={["Article", "Status", "Category", "Author", "Updated", ...(showViews ? ["Views"] : []), <span key="actions" className="sr-only">Actions</span>]}>
            {list.rows.map((a) => {
              const thumb = mediaUrl(a.image);
              const href = `/admin/articles/${a.id}`;
              return (
                <tr key={a.id} className="transition-colors hover:bg-surface">
                  <td className="min-w-[260px] max-w-[440px]">
                    <Link href={href} className="group flex items-center gap-3">
                      <span className="flex h-11 w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-surface-2 max-[520px]:hidden">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Studio thumbnail; Supabase URL varies per environment
                          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <ImageIcon className="size-4 text-muted" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <strong className="block font-semibold text-ink group-hover:text-brand">{a.title}</strong>
                        <small className="mt-1 block truncate text-[11px] text-muted">
                          {a.is_featured && "Featured · "}/balita/{a.slug}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <StatusBadge status={a.status} />
                    {a.published_at && (a.status === "scheduled" || a.status === "published") && (
                      <small className="mt-1.5 block whitespace-nowrap text-[11px] text-muted">
                        {a.status === "scheduled" ? "Goes live " : ""}
                        {formatDateTime(a.published_at)}
                      </small>
                    )}
                  </td>
                  <td>{a.category?.name ?? <span className="text-muted">—</span>}</td>
                  <td className="min-w-36">{a.author?.display_name ?? <span className="text-muted">—</span>}</td>
                  <td className="whitespace-nowrap text-ink-soft">{formatDateTime(a.updated_at)}</td>
                  {showViews && <td className="tabular-nums">{formatNumber(list.views?.get(a.id) ?? 0)}</td>}
                  <td className="text-right">
                    <Link href={href} className="font-bold text-brand hover:underline" aria-label={`Edit ${a.title}`}>
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        <div className="border-t border-line">
          <Pagination
            page={page}
            totalPages={list.totalPages}
            total={list.total}
            pageSize={list.pageSize}
            noun={list.total === 1 ? "article" : "articles"}
            hrefFor={(p) => withParams("/admin/articles", { ...params, page: p })}
          />
        </div>
      </Panel>
    </>
  );
}
