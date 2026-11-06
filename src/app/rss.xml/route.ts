import { listPublicArticles } from "@/lib/cms/articles";
import { getCategoryBySlug, getSiteSettings } from "@/lib/cms/site";
import { siteUrl } from "@/lib/env";
import { logServerError } from "@/lib/log";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/** RSS 2.0 feed of the latest published stories. `?paksa=<category-slug>` gives a per-category feed. */
export async function GET(request: Request) {
  try {
    const settings = await getSiteSettings();
    const slug = new URL(request.url).searchParams.get("paksa");
    const category = slug && /^[a-z0-9-]{1,120}$/.test(slug) ? await getCategoryBySlug(slug) : null;
    const { items } = await listPublicArticles({ pageSize: 30, categoryId: category?.id ?? null });
    const title = category ? `${settings.general.site_name} — ${category.name}` : settings.general.site_name;
    const channelLink = siteUrl(category ? `/paksa/${category.slug}` : "/");
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(title)}</title>
<link>${esc(channelLink)}</link>
<description>${esc(settings.general.description || settings.general.tagline || title)}</description>
<language>fil</language>
<atom:link href="${esc(siteUrl(category ? `/rss.xml?paksa=${category.slug}` : "/rss.xml"))}" rel="self" type="application/rss+xml"/>
${items
  .map((a) => {
    const link = siteUrl(`/balita/${a.slug}`);
    return `<item><title>${esc(a.title)}</title><link>${esc(link)}</link><guid isPermaLink="true">${esc(link)}</guid>${
      a.published_at ? `<pubDate>${new Date(a.published_at).toUTCString()}</pubDate>` : ""
    }${a.excerpt ? `<description>${esc(a.excerpt)}</description>` : ""}${a.category ? `<category>${esc(a.category.name)}</category>` : ""}${
      a.author ? `<dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">${esc(a.author.display_name)}</dc:creator>` : ""
    }</item>`;
  })
  .join("\n")}
</channel>
</rss>`;
    return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    logServerError("rss_failed", error);
    return new Response("Feed unavailable", { status: 503 });
  }
}
