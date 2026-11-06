import { Search } from "lucide-react";
import { ArticleListPage, parsePage } from "@/components/public/article-list-page";
import { headers } from "next/headers";
import { searchPublicArticles } from "@/lib/cms/articles";
import { networkHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { buildMetadata } from "@/lib/seo";

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export function generateMetadata() {
  return buildMetadata({ title: "Maghanap", path: "/hanap", noindex: true });
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 120);
  const limited = q.length >= 2 && !(await checkRateLimit("search", networkHash(await headers())));
  const result = limited
    ? { items: [], total: 0, page: 1, pageSize: 12, totalPages: 0 }
    : await searchPublicArticles(q, parsePage(sp.page));
  return (
    <ArticleListPage
      kicker="Paghahanap"
      title={q ? `Resulta para sa “${q}”` : "Maghanap ng balita"}
      description={q ? `${result.total} ${result.total === 1 ? "resulta" : "mga resulta"}` : "Ilagay ang salita o paksa na hinahanap mo."}
      result={result}
      basePath="/hanap"
      query={q ? { q } : {}}
      emptyTitle={limited ? "Masyadong maraming paghahanap. Subukan muli pagkalipas ng isang minuto." : q.length >= 2 ? "Walang tumugmang balita." : "Maglagay ng hindi bababa sa 2 titik."}
      filters={
        <form action="/hanap" role="search" className="mb-10 flex max-w-2xl gap-2">
          <label htmlFor="q" className="sr-only">
            Maghanap
          </label>
          <input id="q" name="q" type="search" defaultValue={q} maxLength={120} placeholder="hal. presyo ng bigas" className="field h-12" />
          <button type="submit" className="btn btn-primary h-12 shrink-0">
            <Search className="h-4 w-4" aria-hidden="true" /> Hanapin
          </button>
        </form>
      }
    />
  );
}
