import Link from "next/link";
import { ArticleListPage, parsePage } from "@/components/public/article-list-page";
import { listPublicArticles } from "@/lib/cms/articles";
import { redirectOrNotFound } from "@/lib/cms/redirects";
import { getSiteSettings, listLocations, locationWithDescendants } from "@/lib/cms/site";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const found = await locationWithDescendants(slug);
  if (!found) return {};
  return buildMetadata({ title: `Balita mula sa ${found.location.name}`, path: `/rehiyon/${found.location.slug}` });
}

export default async function RegionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const found = await locationWithDescendants(slug);
  if (!found) return redirectOrNotFound(`/rehiyon/${slug}`);
  const [settings, sp, all] = await Promise.all([getSiteSettings(), searchParams, listLocations()]);
  const result = await listPublicArticles({ locationIds: found.ids, page: parsePage(sp.page), pageSize: settings.publication.articles_per_page });
  const children = all.filter((l) => l.parent_id === found.location.id);
  const parent = all.find((l) => l.id === found.location.parent_id);

  return (
    <ArticleListPage
      kicker={parent ? parent.name : "Rehiyon"}
      title={found.location.name}
      result={result}
      basePath={`/rehiyon/${found.location.slug}`}
      emptyTitle={`Wala pang balita mula sa ${found.location.name}.`}
      filters={
        children.length > 0 && (
          <nav aria-label="Mga lugar" className="mb-8 flex flex-wrap gap-2">
            {children.map((c) => (
              <Link key={c.id} href={`/rehiyon/${c.slug}`} className="chip">
                {c.name}
              </Link>
            ))}
          </nav>
        )
      }
    />
  );
}
