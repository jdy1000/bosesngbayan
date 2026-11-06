import "server-only";
import type { Metadata } from "next";
import { getMediaById, getSiteSettings } from "@/lib/cms/site";
import { mediaUrl } from "@/lib/media";
import { siteUrl } from "@/lib/env";
import type { MediaSummary } from "@/lib/cms/articles";

interface PageSeo {
  title?: string | null;
  description?: string | null;
  path: string;
  canonical?: string | null;
  image?: MediaSummary | null;
  noindex?: boolean;
  type?: "website" | "article";
  publishedTime?: string | null;
  modifiedTime?: string | null;
  authors?: string[];
}

/** Metadata with CMS-driven defaults: global SEO settings fill anything the page does not set. */
export async function buildMetadata(page: PageSeo): Promise<Metadata> {
  const { seo, general } = await getSiteSettings();
  const image = page.image ?? (await getMediaById(seo.default_og_image_id));
  const imageUrl = mediaUrl(image);
  const title = page.title ? seo.title_template.replace("%s", page.title) : seo.default_title || general.site_name;
  const description = page.description || seo.default_description || general.description || undefined;
  const canonical = page.canonical || siteUrl(page.path);
  const noindex = page.noindex || !seo.allow_indexing;
  const handle = seo.x_handle ? (seo.x_handle.startsWith("@") ? seo.x_handle : `@${seo.x_handle}`) : undefined;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: page.type ?? "website",
      siteName: general.site_name,
      title,
      description,
      url: canonical,
      locale: "fil_PH",
      images: imageUrl ? [{ url: imageUrl, alt: image?.alt_text ?? "" }] : undefined,
      ...(page.type === "article"
        ? { publishedTime: page.publishedTime ?? undefined, modifiedTime: page.modifiedTime ?? undefined, authors: page.authors }
        : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      site: handle,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}
