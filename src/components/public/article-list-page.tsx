import Link from "next/link";
import { ArticleCard, EmptyState } from "@/components/public/article-card";
import type { ArticleCard as Article, Paginated } from "@/lib/cms/articles";

/** Shared archive layout: lead story + grid + numbered pagination. Used by news, topic, tag, region pages. */
export function ArticleListPage({
  kicker,
  title,
  description,
  result,
  basePath,
  query = {},
  filters,
  emptyTitle = "Wala pang nailalathalang balita dito.",
}: {
  kicker?: string;
  title: string;
  description?: string | null;
  result: Paginated<Article>;
  basePath: string;
  query?: Record<string, string>;
  filters?: React.ReactNode;
  emptyTitle?: string;
}) {
  const [lead, ...rest] = result.items;
  const showLead = result.page === 1 && lead;
  const href = (page: number) => {
    const sp = new URLSearchParams({ ...query, ...(page > 1 ? { page: String(page) } : {}) });
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="container-site py-10 md:py-14">
      <header className="section-kicker mb-8 max-w-3xl">
        {kicker && <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-accent">{kicker}</p>}
        <h1 className="text-4xl font-semibold leading-tight text-ink md:text-5xl">{title}</h1>
        {description && <p className="mt-3 text-lg text-ink-soft">{description}</p>}
      </header>
      {filters}
      {result.items.length === 0 ? (
        <EmptyState title={emptyTitle}>Bumalik muli mamaya para sa mga bagong kwento.</EmptyState>
      ) : (
        <>
          {showLead && (
            <div className="mb-12 border-b border-line pb-12">
              <ArticleCard article={lead} variant="feature" priority />
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(showLead ? rest : result.items).map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </>
      )}
      {result.totalPages > 1 && (
        <nav aria-label="Mga pahina" className="mt-12 flex flex-wrap items-center justify-center gap-2">
          {result.page > 1 && (
            <Link href={href(result.page - 1)} className="btn btn-outline">
              ← Nauna
            </Link>
          )}
          <span className="px-3 text-sm text-muted">
            Pahina {result.page} ng {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={href(result.page + 1)} className="btn btn-outline">
              Susunod →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}
