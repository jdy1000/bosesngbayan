import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { parseSection, type HomepageBlock } from "@/lib/homepage/blocks";
import { logServerError } from "@/lib/log";
import type { Locale } from "@/lib/i18n/config";

export interface HomepageData {
  configurationId: string;
  status: "draft" | "published";
  blocks: HomepageBlock[];
  invalidSections: { id: string; issues: string[] }[];
}

/**
 * Load the homepage configuration. The public site always passes no client (anon → only the
 * published configuration is visible under RLS). Studio preview passes its session client and
 * asks for the draft.
 */
export async function getHomepage(
  status: "draft" | "published" = "published",
  client: SupabaseClient<Database> = createPublicClient(),
  // A promise is accepted so the caller can start this query before the reader's language is known.
  locale: Locale | Promise<Locale> = "fil",
): Promise<HomepageData | null> {
  // One request for the configuration and its enabled sections: every block on the page waits for this answer.
  const [{ data: config, error }, lang] = await Promise.all([
    client
      .from("homepage_configurations")
      .select("id, status, homepage_sections(id, block_type, title, description, title_en, description_en, settings, position, is_enabled)")
      .eq("status", status)
      .eq("homepage_sections.is_enabled", true)
      .order("position", { referencedTable: "homepage_sections" })
      .maybeSingle(),
    locale,
  ]);
  if (error) throw error;
  if (!config) return null;

  const blocks: HomepageBlock[] = [];
  const invalidSections: HomepageData["invalidSections"] = [];
  for (const s of config.homepage_sections) {
    const { block, issues } = parseSection(s, lang);
    if (block) blocks.push(block);
    else {
      invalidSections.push({ id: s.id, issues });
      logServerError("homepage_section_invalid", new Error(`${s.id}: ${issues.join("; ")}`));
    }
  }
  return { configurationId: config.id, status: config.status as "draft" | "published", blocks, invalidSections };
}
