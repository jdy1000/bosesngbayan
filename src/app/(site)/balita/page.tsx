import Link from "next/link";
import { ArticleListPage, parsePage } from "@/components/public/article-list-page";
import { listPublicArticles } from "@/lib/cms/articles";
import { getSiteSettings, listLocations, locationWithDescendants } from "@/lib/cms/site";
import { buildMetadata } from "@/lib/seo";

type Props = { searchParams: Promise<{ page?: string; rehiyon?: string }> };

export function generateMetadata() {
  return buildMetadata({ title: "Mga Balita", description: "Pinakabagong balita mula sa buong Pilipinas.", path: "/balita" });
}

export default async function NewsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const [settings, locations, region] = await Promise.all([
    getSiteSettings(),
    listLocations(),
    sp.rehiyon ? locationWithDescendants(sp.rehiyon) : Promise.resolve(null),
  ]);
  const result = await listPublicArticles({ page, pageSize: settings.publication.articles_per_page, locationIds: region?.ids });
  const islandGroups = locations.filter((l) => l.kind === "island_group");

  return (
    <ArticleListPage
      kicker="Balita"
      title={region ? `Mga Balita — ${region.location.name}` : "Mga Balita"}
      description="Mga pinakabagong balita at mahahalagang kwento mula sa buong bansa."
      result={result}
      basePath="/balita"
      query={region ? { rehiyon: region.location.slug } : {}}
      filters={
        islandGroups.length > 0 && (
          <nav aria-label="Salain ayon sa rehiyon" className="mb-8 flex flex-wrap gap-2">
            <Link href="/balita" className="chip" aria-current={!region ? "page" : undefined} data-active={!region || undefined}>
              Lahat
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
