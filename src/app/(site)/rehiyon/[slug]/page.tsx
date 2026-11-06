import Link from "next/link";
import { ArticleListPage, parsePage } from "@/components/public/article-list-page";
import { listPublicArticles } from "@/lib/cms/articles";
import { redirectOrNotFound } from "@/lib/cms/redirects";
import { getSiteSettings, listLocations, locationWithDescendants } from "@/lib/cms/site";
import { buildMetadata } from "@/lib/seo";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const found = await locationWithDescendants(slug);
  if (!found) return {};
  const { t } = await getI18n();
  return buildMetadata({ title: fmt(t.common.region.metaTitle, { name: found.location.name }), path: `/rehiyon/${found.location.slug}` });
}

export default async function RegionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const found = await locationWithDescendants(slug);
  if (!found) return redirectOrNotFound(`/rehiyon/${slug}`);
  const [settings, sp, all, { t }] = await Promise.all([getSiteSettings(), searchParams, listLocations(), getI18n()]);
  const result = await listPublicArticles({ locationIds: found.ids, page: parsePage(sp.page), pageSize: settings.publication.articles_per_page });
  const children = all.filter((l) => l.parent_id === found.location.id);
  const parent = all.find((l) => l.id === found.location.parent_id);

  return (
    <ArticleListPage
      kicker={parent ? parent.name : t.common.region.kicker}
      title={found.location.name}
      result={result}
      basePath={`/rehiyon/${found.location.slug}`}
      emptyTitle={fmt(t.common.region.empty, { name: found.location.name })}
      filters={
        children.length > 0 && (
          <nav aria-label={t.common.region.places} className="mb-8 flex flex-wrap gap-2">
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
