import { ArticleView } from "@/components/public/article-view";
import { CommentSection } from "@/components/public/comment-section";
import { NewsletterForm } from "@/components/public/newsletter-form";
import { PageViewTracker } from "@/components/public/page-view-tracker";
import { getPublicArticleBySlug, getRelatedArticles } from "@/lib/cms/articles";
import { listApprovedComments } from "@/lib/cms/community";
import { redirectOrNotFound } from "@/lib/cms/redirects";
import { getSiteSettings } from "@/lib/cms/site";
import { localizeSettings } from "@/lib/settings/schema";
import { siteUrl } from "@/lib/env";
import { timeAgo } from "@/lib/format";
import { getLocale } from "@/lib/i18n/server";
import { mediaUrl } from "@/lib/media";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const article = await getPublicArticleBySlug(slug);
  if (!article) return {};
  return buildMetadata({
    title: article.seo_title || article.title,
    description: article.seo_description || article.excerpt,
    path: `/balita/${article.slug}`,
    canonical: article.canonical_url,
    image: article.og_image ?? article.image,
    type: "article",
    publishedTime: article.first_published_at ?? article.published_at,
    modifiedTime: article.content_updated_at,
    authors: article.author ? [article.author.display_name] : undefined,
  });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getPublicArticleBySlug(slug);
  if (!article) return redirectOrNotFound(`/balita/${slug}`);

  const [related, rawSettings, locale] = await Promise.all([getRelatedArticles(article), getSiteSettings(), getLocale()]);
  // Text the reader sees (newsletter title, consent) follows the reader's language; the consent shown must equal the consent stored.
  const settings = localizeSettings(rawSettings, locale);
  const commentsOpen = article.allow_comments && settings.publication.comments_enabled;
  const comments = commentsOpen || article.allow_comments ? await listApprovedComments({ articleId: article.id }) : [];
  const url = siteUrl(`/balita/${article.slug}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt ?? undefined,
    datePublished: article.first_published_at ?? article.published_at,
    dateModified: article.content_updated_at ?? article.published_at,
    mainEntityOfPage: url,
    image: mediaUrl(article.image) ?? undefined,
    author: article.author ? { "@type": "Person", name: article.author.display_name } : undefined,
    publisher: { "@type": "Organization", name: settings.general.site_name },
    articleSection: article.category?.name,
    inLanguage: "fil",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageViewTracker articleId={article.id} />
      <ArticleView
        article={article}
        related={related}
        shareUrl={url}
        afterBody={
          <>
            {settings.newsletter.enabled && (
              <aside className="mt-12 rounded-md bg-brand-50 p-6 md:p-8">
                <h2 className="text-2xl font-semibold text-ink">{settings.footer.newsletter_title}</h2>
                {settings.footer.newsletter_description && <p className="mt-1 text-ink-soft">{settings.footer.newsletter_description}</p>}
                <div className="mt-4">
                  <NewsletterForm consentText={settings.newsletter.consent_text} source="article" />
                </div>
              </aside>
            )}
            {article.allow_comments && (
              <CommentSection
                target={{ articleId: article.id }}
                isOpen={commentsOpen}
                comments={comments.map((c) => ({ ...c, created_label: timeAgo(c.created_at, undefined, locale) }))}
              />
            )}
          </>
        }
      />
    </>
  );
}
