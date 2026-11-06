import "server-only";
import type { StaffContext } from "@/lib/auth/session";
import { BLOCK_SETTINGS_SCHEMAS, isBlockType, type BlockType } from "@/lib/homepage/blocks";
import { mediaUrl } from "@/lib/media";
import type { BuilderOptions, BuilderSection, PickedArticle } from "@/app/admin/(studio)/homepage/types";
import type { PickedMedia } from "@/components/studio/media-picker";

/** Validate settings against the typed block schema. The only path by which settings reach the DB. */
export function validateSettings(type: BlockType, raw: unknown) {
  return BLOCK_SETTINGS_SCHEMAS[type].safeParse(raw);
}

export function settingsIssues(type: string, raw: unknown): string[] {
  if (!isBlockType(type)) return [`Unknown block type: ${type}`];
  const r = validateSettings(type, raw);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".") || "settings"}: ${i.message}`);
}

const CONFIG_COLUMNS =
  "id, status, label, published_at, created_at, updated_at, publisher:profiles!homepage_configurations_published_by_fkey(display_name), editor:profiles!homepage_configurations_updated_by_fkey(display_name)";

export async function getDraftConfigId(ctx: StaffContext): Promise<string | null> {
  const { data, error } = await ctx.supabase.from("homepage_configurations").select("id").eq("status", "draft").maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function listSections(ctx: StaffContext, configurationId: string) {
  const { data, error } = await ctx.supabase
    .from("homepage_sections")
    .select("id, block_type, position, is_enabled, title, description, title_en, description_en, settings, updated_at")
    .eq("configuration_id", configurationId)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

function collectIds(value: unknown, keys: ReadonlySet<string>, out: Set<string>) {
  if (Array.isArray(value)) for (const v of value) collectIds(v, keys, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (!keys.has(k)) {
        collectIds(v, keys, out);
        continue;
      }
      for (const x of Array.isArray(v) ? v : [v]) if (typeof x === "string") out.add(x);
    }
  }
}

/** Everything the builder screen needs, loaded with the session client (RLS applies). */
export async function loadBuilder(ctx: StaffContext) {
  const db = ctx.supabase;
  const draftId = await getDraftConfigId(ctx);
  const [sections, configs, polls, categories, locations] = await Promise.all([
    draftId ? listSections(ctx, draftId) : Promise.resolve([]),
    db.from("homepage_configurations").select(CONFIG_COLUMNS).in("status", ["published", "archived"]).order("created_at", { ascending: false }).limit(15),
    db.from("polls").select("id, question, status").in("status", ["published", "closed"]).order("created_at", { ascending: false }).limit(100),
    db.from("categories").select("id, name, is_active").order("sort_order").order("name"),
    db.from("locations").select("id, name, kind, is_active").order("sort_order").order("name"),
  ]);
  for (const r of [configs, polls, categories, locations]) if (r.error) throw r.error;

  const history = configs.data ?? [];
  const counts = new Map<string, number>();
  if (history.length) {
    const { data, error } = await db.from("homepage_sections").select("configuration_id").in("configuration_id", history.map((c) => c.id));
    if (error) throw error;
    for (const s of data ?? []) counts.set(s.configuration_id, (counts.get(s.configuration_id) ?? 0) + 1);
  }

  const mediaIds = new Set<string>();
  const articleIds = new Set<string>();
  for (const s of sections) {
    collectIds(s.settings, new Set(["image_id", "media_id"]), mediaIds);
    collectIds(s.settings, new Set(["article_id", "article_ids"]), articleIds);
  }
  const [media, articles] = await Promise.all([
    mediaIds.size
      ? db.from("media_assets").select("id, storage_path, external_url, alt_text, file_name").in("id", [...mediaIds])
      : Promise.resolve({ data: [], error: null }),
    articleIds.size ? db.from("articles").select("id, title, status").in("id", [...articleIds]) : Promise.resolve({ data: [], error: null }),
  ]);
  if (media.error) throw media.error;
  if (articles.error) throw articles.error;

  const mediaMap: Record<string, PickedMedia> = {};
  for (const m of media.data ?? []) mediaMap[m.id] = { id: m.id, url: mediaUrl(m), alt_text: m.alt_text, file_name: m.file_name };
  const articleMap: Record<string, PickedArticle> = {};
  for (const a of articles.data ?? []) articleMap[a.id] = { id: a.id, title: a.title, published: a.status === "published" };

  const options: BuilderOptions = {
    polls: (polls.data ?? []).map((p) => ({ id: p.id, label: p.status === "closed" ? `${p.question} (closed)` : p.question })),
    categories: (categories.data ?? []).map((c) => ({ id: c.id, label: c.is_active ? c.name : `${c.name} (inactive)` })),
    locations: (locations.data ?? []).map((l) => ({ id: l.id, label: `${l.name} · ${l.kind.replace("_", " ")}` })),
    mediaMap,
    articleMap,
  };

  const builderSections: BuilderSection[] = sections.map((s) => ({
    id: s.id,
    type: s.block_type,
    position: s.position,
    isEnabled: s.is_enabled,
    title: s.title,
    description: s.description,
    titleEn: s.title_en,
    descriptionEn: s.description_en,
    settings: (s.settings ?? {}) as Record<string, unknown>,
    issues: settingsIssues(s.block_type, s.settings),
    updatedAt: s.updated_at,
  }));

  return {
    draftId,
    sections: builderSections,
    history: history.map((c) => ({
      id: c.id,
      status: c.status,
      label: c.label,
      publishedAt: c.published_at,
      createdAt: c.created_at,
      publisher: c.publisher?.display_name ?? null,
      sectionCount: counts.get(c.id) ?? 0,
    })),
    options,
  };
}
