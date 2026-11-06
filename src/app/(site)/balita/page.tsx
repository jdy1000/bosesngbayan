import Link from "next/link";
import { ArticleListPage, parsePage } from "@/components/public/article-list-page";
import { listPublicArticles } from "@/lib/cms/articles";
import { getSiteSettings, listLocations, locationWithDescendants } from "@/lib/cms/site";
import { buildMetadata } from "@/lib/seo";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

type Props = { searchParams: Promise<{ page?: string; rehiyon?: string }> };

export async function generateMetadata() {
  const { t } = await getI18n();
  return buildMetadata({ title: t.common.news.metaTitle, description: t.common.news.metaDescription, path: "/balita" });
}

export default async function NewsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const [{ t }, settings, locations, region] = await Promise.all([
    getI18n(),
    getSiteSettings(),
    listLocations(),
    sp.rehiyon ? locationWithDescendants(sp.rehiyon) : Promise.resolve(null),
  ]);
  const result = await listPublicArticles({ page, pageSize: settings.publication.articles_per_page, locationIds: region?.ids });
  const islandGroups = locations.filter((l) => l.kind === "island_group");

  return (
    <ArticleListPage
      kicker={t.common.news.kicker}
      title={region ? fmt(t.common.news.titleRegion, { region: region.location.name }) : t.common.news.title}
      description={t.common.news.description}
      result={result}
      basePath="/balita"
      query={region ? { rehiyon: region.location.slug } : {}}
      filters={
        islandGroups.length > 0 && (
          <nav aria-label={t.common.news.regionFilter} className="mb-8 flex flex-wrap gap-2">
            <Link href="/balita" className="chip" aria-current={!region ? "page" : undefined} data-active={!region || undefined}>
              {t.common.news.all}
            </Link>
            {islandGroups.map((l) => (
              <Link
                key={l.id}
                href={`/balita?rehiyon=${l.slug}`}
                className="chip data-[active]:bg-brand data-[active]:text-white"
                aria-current={region?.location.id === l.id ? "page" : undefined}
                data-active={region?.location.id === l.id || undefined}
              >
                {l.name}
              </Link>
            ))}
          </nav>
        )
      }
    />
  );
}
