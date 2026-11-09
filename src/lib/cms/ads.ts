import "server-only";
import { createPublicClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log";
import { mediaUrl } from "@/lib/media";

export interface PublicAd {
  id: string;
  href: string;
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
}

/**
 * The one live ad for a placement, or null. Uses the anon client: the ad_slots_read RLS policy
 * only exposes active ads inside their start/end window. Errors return null so an ad outage
 * never takes down editorial pages.
 */
export async function getLiveAd(placement: "home" | "article"): Promise<PublicAd | null> {
  const { data, error } = await createPublicClient()
    .from("ad_slots")
    .select("id, name, alt_text, destination_url, image:media_assets(kind, storage_path, external_url, alt_text, width, height)")
    .eq("placement", placement)
    .order("sort_order")
    .order("created_at")
    .limit(5);
  if (error) {
    logServerError("ad_lookup_failed", error);
    return null;
  }
  for (const ad of data ?? []) {
    const image = ad.image as { kind: string; storage_path: string | null; external_url: string | null; alt_text: string | null; width: number | null; height: number | null } | null;
    const src = image?.kind === "image" ? mediaUrl(image) : null;
    // The DB already enforces https; re-check so a bad row can never become a javascript: link.
    if (!src || !/^https:\/\/[^\s]+$/.test(ad.destination_url)) continue;
    return { id: ad.id, href: ad.destination_url, src, alt: ad.alt_text || image?.alt_text || ad.name, width: image?.width ?? null, height: image?.height ?? null };
  }
  return null;
}
