import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import { getSiteSettings, listCategories } from "@/lib/cms/site";
import { logServerError } from "@/lib/log";

export const dynamic = "force-dynamic";
const MAX_ARTICLES = 5000; // shortcut: single sitemap file; split into a sitemap index past ~5k URLs.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSiteSettings();
  if (!settings.seo.allow_indexing) return [];
  const supabase = createPublicClient();
  const now = new Date().toISOString();
  try {
    const [articles, pages, polls, categories] = await Promise.all([
      supabase
        .from("articles")
        .select("slug, content_updated_at, published_at")
        .in("status", ["published", "scheduled"])
        .lte("published_at", now)
        .order("published_at", { ascending: false })
        .limit(MAX_ARTICLES),
      supabase.from("pages").select("slug, updated_at, robots_noindex").eq("status", "published"),
      supabase.from("polls").select("slug, updated_at").in("status", ["published", "closed"]),
      listCategories(),
    ]);
    return [
      { url: siteUrl("/"), changeFrequency: "hourly", priority: 1 },
      { url: siteUrl("/balita"), changeFrequency: "hourly", priority: 0.9 },
      { url: siteUrl("/botohan"), changeFrequency: "daily", priority: 0.7 },
      { url: siteUrl("/usap-bayan"), changeFrequency: "daily", priority: 0.6 },
      { url: siteUrl("/mag-ulat"), changeFrequency: "monthly", priority: 0.5 },
      ...categories.map((c) => ({ url: siteUrl(`/paksa/${c.slug}`), changeFrequency: "daily" as const, priority: 0.6 })),
      ...(articles.data ?? []).map((a) => ({
        url: siteUrl(`/balita/${a.slug}`),
        lastModified: a.content_updated_at ?? a.published_at ?? undefined,
        priority: 0.8,
      })),
      ...(pages.data ?? []).filter((p) => !p.robots_noindex).map((p) => ({ url: siteUrl(`/${p.slug}`), lastModified: p.updated_at, priority: 0.4 })),
      ...(polls.data ?? []).map((p) => ({ url: siteUrl(`/botohan/${p.slug}`), lastModified: p.updated_at, priority: 0.5 })),
    ];
  } catch (error) {
    logServerError("sitemap_failed", error);
    return [{ url: siteUrl("/") }];
  }
}
