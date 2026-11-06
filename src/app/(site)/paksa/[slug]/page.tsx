import { ArticleListPage, parsePage } from "@/components/public/article-list-page";
import { listPublicArticles } from "@/lib/cms/articles";
import { redirectOrNotFound } from "@/lib/cms/redirects";
import { getCategoryBySlug, getSiteSettings } from "@/lib/cms/site";
import { buildMetadata } from "@/lib/seo";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  return buildMetadata({
    title: category.seo_title || category.name,
    description: category.seo_description || category.description,
    path: `/paksa/${category.slug}`,
    image: category.image,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return redirectOrNotFound(`/paksa/${slug}`);
  const [settings, sp, { t }] = await Promise.all([getSiteSettings(), searchParams, getI18n()]);
  const page = parsePage(sp.page);
  const result = await listPublicArticles({ categoryId: category.id, page, pageSize: settings.publication.articles_per_page });
  return (
    <ArticleListPage
      kicker={t.common.topics.kicker}
      title={category.name}
      description={category.description}
      result={result}
      basePath={`/paksa/${category.slug}`}
      emptyTitle={fmt(t.common.topics.emptyCategory, { name: category.name })}
    />
  );
}
