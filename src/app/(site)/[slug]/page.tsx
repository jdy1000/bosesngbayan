import { redirectOrNotFound } from "@/lib/cms/redirects";
import { getPublishedPage } from "@/lib/cms/site";
import { formatDate } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const page = await getPublishedPage((await params).slug);
  if (!page) return {};
  return buildMetadata({
    title: page.seo_title || page.title,
    description: page.seo_description || page.summary,
    path: `/${page.slug}`,
    canonical: page.canonical_url,
    image: page.og_image,
    noindex: page.robots_noindex,
  });
}

/** CMS-managed static pages (Tungkol, Privacy Policy, …). Body HTML is sanitized on save. */
export default async function StaticPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return redirectOrNotFound(`/${slug}`);
  return (
    <article className="container-site max-w-[760px] py-10 md:py-14">
      <header className="section-kicker mb-8">
        <h1 className="font-serif text-4xl font-bold leading-tight text-navy md:text-5xl">{page.title}</h1>
        {page.summary && <p className="mt-3 text-lg text-ink-soft">{page.summary}</p>}
        <p className="mt-3 text-sm text-muted">Huling na-update {formatDate(page.updated_at)}</p>
      </header>
      <div className="prose-bnb" dangerouslySetInnerHTML={{ __html: page.body_html }} />
    </article>
  );
}
