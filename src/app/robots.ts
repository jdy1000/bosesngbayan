import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { getSiteSettings } from "@/lib/cms/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { seo } = await getSiteSettings();
  if (!seo.allow_indexing) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/api/", "/hanap", "/newsletter/"] },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
