import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import { parseSettings, type SiteSettings } from "@/lib/settings/schema";
import type { MediaSummary } from "@/lib/cms/articles";

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const { data, error } = await createPublicClient().from("site_settings").select("key, value");
  if (error) throw error;
  return parseSettings(data ?? []);
});

export interface NavItem {
  id: string;
  label: string;
  href: string;
  openInNewTab: boolean;
  children: NavItem[];
}

export const getMenu = cache(async (key: string): Promise<NavItem[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("navigation_items")
    .select("id, parent_id, label, href, position, open_in_new_tab, navigation_menus!inner(key)")
    .eq("navigation_menus.key", key)
    .eq("is_visible", true)
    .order("position");
  if (error) throw error;
  const rows = data ?? [];
  const toItem = (r: (typeof rows)[number]): NavItem => ({
    id: r.id,
    label: r.label,
    href: r.href,
    openInNewTab: r.open_in_new_tab,
    children: rows.filter((c) => c.parent_id === r.id).map(toItem),
  });
  return rows.filter((r) => r.parent_id === null).map(toItem);
});

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  image: MediaSummary | null;
}

export const listCategories = cache(async (): Promise<CategorySummary[]> => {
  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, slug, name, description, is_featured, seo_title, seo_description, image:media_assets(id, storage_path, external_url, alt_text, caption, credit, width, height)")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as CategorySummary[];
});

export async function getCategoryBySlug(slug: string): Promise<CategorySummary | null> {
  return (await listCategories()).find((c) => c.slug === slug) ?? null;
}

export async function getTagBySlug(slug: string): Promise<{ id: string; slug: string; name: string; description: string | null } | null> {
  const { data, error } = await createPublicClient().from("tags").select("id, slug, name, description").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

export interface TrendingTopic {
  id: string;
  label: string;
  href: string;
}

export const listTrendingTopics = cache(async (): Promise<TrendingTopic[]> => {
  const { data, error } = await createPublicClient()
    .from("trending_topics")
    .select("id, label, href, category:categories(slug, is_active), tag:tags(slug)")
    .eq("is_active", true)
    .order("position");
  if (error) throw error;
  type Row = { id: string; label: string; href: string | null; category: { slug: string; is_active: boolean } | null; tag: { slug: string } | null };
  return ((data ?? []) as unknown as Row[])
    .map((r) => ({
      id: r.id,
      label: r.label,
      href: r.href ?? (r.category?.is_active ? `/paksa/${r.category.slug}` : r.tag ? `/tag/${r.tag.slug}` : ""),
    }))
    .filter((t) => t.href !== "");
});

export interface LocationNode {
  id: string;
  slug: string;
  name: string;
  kind: "island_group" | "region" | "province" | "city";
  parent_id: string | null;
}

export const listLocations = cache(async (): Promise<LocationNode[]> => {
  const { data, error } = await createPublicClient()
    .from("locations")
    .select("id, slug, name, kind, parent_id")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data ?? [];
});

/** A location plus all of its descendants (e.g. Visayas → its regions → provinces → cities). */
export async function locationWithDescendants(slug: string): Promise<{ location: LocationNode; ids: string[] } | null> {
  const all = await listLocations();
  const location = all.find((l) => l.slug === slug);
  if (!location) return null;
  const ids = [location.id];
  for (let i = 0; i < ids.length; i++) {
    for (const child of all) if (child.parent_id === ids[i]) ids.push(child.id);
  }
  return { location, ids };
}

export interface PublicPage {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body_html: string;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  robots_noindex: boolean;
  published_at: string | null;
  updated_at: string;
  og_image: MediaSummary | null;
}

export const getPublishedPage = cache(async (slug: string): Promise<PublicPage | null> => {
  const { data, error } = await createPublicClient()
    .from("pages")
    .select(
      "id, slug, title, summary, body_html, seo_title, seo_description, canonical_url, robots_noindex, published_at, updated_at, og_image:media_assets(id, storage_path, external_url, alt_text, caption, credit, width, height)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data as unknown as PublicPage | null;
});

export async function getMediaById(id: string | null | undefined): Promise<MediaSummary | null> {
  if (!id) return null;
  const { data, error } = await createPublicClient()
    .from("media_assets")
    .select("id, storage_path, external_url, alt_text, caption, credit, width, height")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTotalBallots(): Promise<number> {
  const { data, error } = await createPublicClient().rpc("get_total_ballots");
  if (error) throw error;
  return Number(data ?? 0);
}
