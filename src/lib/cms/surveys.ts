import "server-only";
import { createPublicClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log";
import { mediaUrl } from "@/lib/media";
import type { PhotoPosition } from "@/lib/survey-photo";

export interface PublicSurveyEntry {
  id: string;
  rank: number | null;
  name: string;
  area: string | null;
  overall: number | null;
  trust: number | null;
  performance: number | null;
  photo: ({ src: string; alt: string } & PhotoPosition) | null;
}

export interface PublicSurvey {
  id: string;
  title: string;
  scope: string | null;
  subtitle: string | null;
  note: string | null;
  /** yyyy-mm-dd, the day the ratings were released. */
  date: string;
  entries: PublicSurveyEntry[];
}

/** A homepage carousel shows at most this many surveys as tabs. */
const MAX_HOMEPAGE_SURVEYS = 6;

interface MediaRow {
  kind: string;
  storage_path: string | null;
  external_url: string | null;
  alt_text: string | null;
}

/**
 * Published surveys flagged for the homepage, with their cards. Anon client: the surveys / survey_entries RLS
 * policies only expose published surveys. Errors and empty results return [] so the homepage never breaks over it.
 */
export async function getHomepageSurveys(): Promise<PublicSurvey[]> {
  const { data, error } = await createPublicClient()
    .from("surveys")
    .select(
      "id, title, scope, subtitle, note, survey_date, entries:survey_entries(id, position, rank_no, name, area, overall_pct, trust_pct, performance_pct, photo_x, photo_y, photo_zoom, photo:media_assets(kind, storage_path, external_url, alt_text))",
    )
    .eq("is_published", true)
    .eq("show_on_homepage", true)
    .order("sort_order")
    .order("survey_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("position", { referencedTable: "survey_entries" })
    .order("created_at", { referencedTable: "survey_entries" })
    .limit(MAX_HOMEPAGE_SURVEYS);
  if (error) {
    logServerError("surveys_lookup_failed", error);
    return [];
  }
  return (data ?? [])
    .map((s) => ({
      id: s.id,
      title: s.title,
      scope: s.scope,
      subtitle: s.subtitle,
      note: s.note,
      date: s.survey_date,
      entries: s.entries.map((e) => {
        const media = e.photo as MediaRow | null;
        const src = media?.kind === "image" ? mediaUrl(media) : null;
        return {
          id: e.id,
          rank: e.rank_no,
          name: e.name,
          area: e.area,
          overall: e.overall_pct,
          trust: e.trust_pct,
          performance: e.performance_pct,
          photo: src ? { src, alt: media?.alt_text || e.name, x: e.photo_x, y: e.photo_y, zoom: e.photo_zoom } : null,
        };
      }),
    }))
    .filter((s) => s.entries.length > 0);
}
