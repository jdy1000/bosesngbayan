import Image from "next/image";
import Link from "next/link";
import { ArticleCard, SectionHeading } from "@/components/public/article-card";
import { ShareButtons } from "@/components/public/share-buttons";
import type { ArticleCard as Card, ArticleDetail } from "@/lib/cms/articles";
import { formatDateTime } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

/**
 * Article presentation shared by the public page and the protected Studio preview.
 * `bodyHtml` was sanitized on save (src/lib/rich-text/render.ts) — never pass unsanitized HTML here.
 */
export function ArticleView({
  article,
  related,
  shareUrl,
  afterBody,
  banner,
}: {
  article: ArticleDetail;
  related: Card[];
  shareUrl: string;
  afterBody?: React.ReactNode;
  banner?: React.ReactNode;
}) {
  const image = mediaUrl(article.image);
  const firstPublished = article.first_published_at ?? article.published_at;
  const updated =
    article.content_updated_at && firstPublished && new Date(article.content_updated_at).getTime() - new Date(firstPublished).getTime() > 60_000
      ? article.content_updated_at
      : null;

  return (
    <article>
      {banner}
      <div className="container-site max-w-[860px] pt-8 md:pt-12">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-brand">Bahay</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/balita" className="hover:text-brand">Mga Balita</Link>
            </li>
            {article.category && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/paksa/${article.category.slug}`} className="hover:text-brand">{article.category.name}</Link>
                </li>
              </>
            )}
          </ol>
        </nav>
        <div className="flex flex-wrap gap-2">
          {article.is_breaking && <span className="category-badge bg-accent text-white">Breaking</span>}
          {article.category && (
            <Link href={`/paksa/${article.category.slug}`} className="category-badge">
              {article.category.name}
            </Link>
          )}
          {article.location && (
            <Link href={`/rehiyon/${article.location.slug}`} className="category-badge bg-surface-2 text-ink-soft">
              {article.location.name}
            </Link>
          )}
        </div>
        <h1 className="mt-4 font-serif text-[2.2rem] font-bold leading-[1.1] tracking-[-0.01em] text-navy md:text-[3rem]">{article.title}</h1>
        {article.subtitle && <p className="mt-4 text-xl leading-relaxed text-ink-soft">{article.subtitle}</p>}

        <div className="mt-6 flex flex-col gap-4 border-y border-line py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-ink-soft">
            {article.author && (
              <p>
                Ni <strong className="font-semibold text-ink">{article.author.display_name}</strong>
                {article.author.title ? `, ${article.author.title}` : ""}
                {article.contributors.length > 0 &&
                  ` · ${article.contributors
                    .filter((c) => c.profile)
                    .map((c) => `${c.role_label}: ${c.profile!.display_name}`)
                    .join(", ")}`}
              </p>
            )}
            <p className="mt-0.5 text-muted">
              {firstPublished && (
                <>
                  Inilathala <time dateTime={firstPublished}>{formatDateTime(firstPublished)}</time>
                </>
              )}
              {updated && (
                <>
                  {" · "}In-update <time dateTime={updated}>{formatDateTime(updated)}</time>
                </>
              )}
              {article.reading_minutes > 0 && ` · ${article.reading_minutes} minutong basa`}
            </p>
          </div>
          <ShareButtons url={shareUrl} title={article.title} />
        </div>
      </div>

      {image && (
        <figure className="container-site mt-8 max-w-[1040px]">
          <div className="relative aspect-[16/9] overflow-hidden rounded-[18px] bg-surface-2">
            <Image src={image} alt={article.image?.alt_text ?? ""} fill priority sizes="(min-width: 1040px) 1040px, 100vw" className="object-cover" />
          </div>
          {(article.image?.caption || article.image?.credit) && (
            <figcaption className="mt-2 text-sm text-muted">
              {article.image?.caption}
              {article.image?.credit && <span className="ml-1 text-muted/80">Larawan: {article.image.credit}</span>}
            </figcaption>
          )}
        </figure>
      )}

      <div className="container-site max-w-[760px] py-10">
        {article.correction_note && (
          <aside className="mb-8 rounded-xl border-l-4 border-accent bg-red-50/60 px-5 py-4 text-[0.95rem] text-ink">
            <p className="font-bold">Pagwawasto</p>
            <p className="mt-1">{article.correction_note}</p>
          </aside>
        )}
        <div className="prose-bnb" dangerouslySetInnerHTML={{ __html: article.body_html }} />
        {article.source_attribution && (
          <p className="mt-10 border-t border-line pt-4 text-sm text-muted">
            <strong className="font-semibold text-ink-soft">Mga pinagkunan:</strong> {article.source_attribution}
          </p>
        )}
        {article.tags.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Mga tag">
            {article.tags.map((t) => (
              <li key={t.id}>
                <Link href={`/tag/${t.slug}`} className="chip">
                  #{t.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {article.author?.bio && (
          <div className="mt-10 rounded-xl bg-surface p-5">
            <p className="text-sm font-bold text-ink">Tungkol kay {article.author.display_name}</p>
            <p className="mt-1 text-[0.95rem] text-ink-soft">{article.author.bio}</p>
          </div>
        )}
        {afterBody}
      </div>

      {related.length > 0 && (
        <section className="bg-surface py-14">
          <div className="container-site">
            <SectionHeading title="Kaugnay na mga Balita" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
