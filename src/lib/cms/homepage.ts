import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { parseSection, type HomepageBlock } from "@/lib/homepage/blocks";
import { logServerError } from "@/lib/log";

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
): Promise<HomepageData | null> {
  const { data: config, error } = await client
    .from("homepage_configurations")
    .select("id, status")
    .eq("status", status)
    .maybeSingle();
  if (error) throw error;
  if (!config) return null;

  const { data: sections, error: secError } = await client
    .from("homepage_sections")
    .select("id, block_type, title, description, settings, position, is_enabled")
    .eq("configuration_id", config.id)
    .eq("is_enabled", true)
    .order("position");
  if (secError) throw secError;

  const blocks: HomepageBlock[] = [];
  const invalidSections: HomepageData["invalidSections"] = [];
  for (const s of sections ?? []) {
    const { block, issues } = parseSection(s);
    if (block) blocks.push(block);
    else {
      invalidSections.push({ id: s.id, issues });
      logServerError("homepage_section_invalid", new Error(`${s.id}: ${issues.join("; ")}`));
    }
  }
  return { configurationId: config.id, status: config.status as "draft" | "published", blocks, invalidSections };
}
