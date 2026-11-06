import { Search } from "lucide-react";
import { ArticleListPage, parsePage } from "@/components/public/article-list-page";
import { headers } from "next/headers";
import { searchPublicArticles } from "@/lib/cms/articles";
import { networkHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { buildMetadata } from "@/lib/seo";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export async function generateMetadata() {
  const { t } = await getI18n();
  return buildMetadata({ title: t.common.searchPage.metaTitle, path: "/hanap", noindex: true });
}

export default async function SearchPage({ searchParams }: Props) {
  const [sp, { t }] = await Promise.all([searchParams, getI18n()]);
  const s = t.common.searchPage;
  const q = (sp.q ?? "").trim().slice(0, 120);
  const limited = q.length >= 2 && !(await checkRateLimit("search", networkHash(await headers())));
  const result = limited
    ? { items: [], total: 0, page: 1, pageSize: 12, totalPages: 0 }
    : await searchPublicArticles(q, parsePage(sp.page));
  return (
    <ArticleListPage
      kicker={s.kicker}
      title={q ? fmt(s.titleQuery, { q }) : s.title}
      description={q ? fmt(result.total === 1 ? s.resultsOne : s.resultsOther, { n: result.total }) : s.prompt}
      result={result}
      basePath="/hanap"
      query={q ? { q } : {}}
      emptyTitle={limited ? s.rateLimited : q.length >= 2 ? s.noMatch : s.tooShort}
      filters={
        <form action="/hanap" role="search" className="mb-10 flex max-w-2xl gap-2">
          <label htmlFor="q" className="sr-only">
            {t.common.search}
          </label>
          <input id="q" name="q" type="search" defaultValue={q} maxLength={120} placeholder={s.placeholder} className="field h-12" />
          <button type="submit" className="btn btn-primary h-12 shrink-0">
            <Search className="h-4 w-4" aria-hidden="true" /> {s.submit}
          </button>
        </form>
      }
    />
  );
}
