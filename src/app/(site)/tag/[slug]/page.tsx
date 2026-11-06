import { ArticleListPage, parsePage } from "@/components/public/article-list-page";
import { listPublicArticles } from "@/lib/cms/articles";
import { redirectOrNotFound } from "@/lib/cms/redirects";
import { getSiteSettings, getTagBySlug } from "@/lib/cms/site";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) return {};
  return buildMetadata({ title: `#${tag.name}`, description: tag.description, path: `/tag/${tag.slug}` });
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) return redirectOrNotFound(`/tag/${slug}`);
  const [settings, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const result = await listPublicArticles({ tagId: tag.id, page: parsePage(sp.page), pageSize: settings.publication.articles_per_page });
  return <ArticleListPage kicker="Tag" title={`#${tag.name}`} description={tag.description} result={result} basePath={`/tag/${tag.slug}`} />;
}
