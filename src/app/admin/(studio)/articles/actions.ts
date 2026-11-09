"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAnyPermission, requirePermission, type StaffContext } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { need } from "./db";
import type { FormActionResult } from "@/components/studio/action-form";
import { isValidSlug, manilaLocalToIso, slugify } from "@/lib/format";
import { renderRichText } from "@/lib/rich-text/render";
import { safeLike, type ArticleStatus } from "@/lib/studio/articles";
import { articleFormSchema, type SaveResult } from "./schema";

const uuid = z.uuid("Invalid ID.");
const EDITORS = ["articles.edit_own", "articles.edit_any"] as const;

async function revalidateArticle(ctx: StaffContext, slug: string, categoryId: string | null) {
  revalidatePath("/");
  revalidatePath("/balita");
  revalidatePath(`/balita/${slug}`);
  if (categoryId) {
    const { data } = await ctx.supabase.from("categories").select("slug").eq("id", categoryId).maybeSingle();
    if (data) revalidatePath(`/paksa/${data.slug}`);
  }
}

function isPublic(status: ArticleStatus, publishedAt: string | null): boolean {
  return (status === "published" || status === "scheduled") && publishedAt !== null && new Date(publishedAt) <= new Date();
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

// ---------------------------------------------------------------------------
// Create / duplicate
// ---------------------------------------------------------------------------
/**
 * First save from the full "New article" editor: insert the draft (author = caller), then run the normal
 * save on it so every field, relation and the first revision go through the same validated path.
 * Returns the new id; if the row exists but the follow-up save failed, the id is still returned so the
 * caller can open the draft instead of losing it.
 */
export async function createArticleFromEditor(formData: FormData): Promise<(SaveResult & { id?: string })> {
  try {
    const ctx = await requirePermission("articles.create");
    const parsed = articleFormSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: issue?.message ?? "Please check the fields.", field: String(issue?.path[0] ?? "") };
    }
    const f = parsed.data;
    const insert = (slug: string) =>
      ctx.supabase
        .from("articles")
        .insert({ title: f.title, slug, category_id: f.category_id, author_id: ctx.userId })
        .select("id, slug, updated_at")
        .single();
    let res = await insert(f.slug);
    if (res.error?.code === "23505") res = await insert(`${f.slug.slice(0, 150)}-${randomSuffix()}`);
    const row = need(res);
    const fd = new FormData();
    for (const [k, v] of formData) fd.append(k, v);
    fd.set("slug", row.slug);
    const saved = await saveArticle(row.id, row.updated_at, fd, true);
    return { ...saved, id: row.id };
  } catch (e) {
    return toActionError(e);
  }
}

export async function duplicateArticle(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("articles.create");
    const id = uuid.parse(formData.get("id"));
    const src = need(await ctx.supabase.from("articles").select("*, article_tags(tag_id)").eq("id", id).single());
    const slug = `${src.slug.slice(0, 145)}-kopya-${randomSuffix()}`;
    const copy = need(
      await ctx.supabase
        .from("articles")
        .insert({
          slug,
          title: `(Copy) ${src.title}`.slice(0, 300),
          subtitle: src.subtitle,
          excerpt: src.excerpt,
          body: src.body,
          body_html: src.body_html,
          body_text: src.body_text,
          reading_minutes: src.reading_minutes,
          category_id: src.category_id,
          location_id: src.location_id,
          featured_image_id: src.featured_image_id,
          og_image_id: src.og_image_id,
          seo_title: src.seo_title,
          seo_description: src.seo_description,
          source_attribution: src.source_attribution,
          allow_comments: src.allow_comments,
          author_id: ctx.userId,
        })
        .select("id")
        .single(),
    );
    const tagRows = (src.article_tags as { tag_id: string }[]).map((t) => ({ article_id: copy.id, tag_id: t.tag_id }));
    if (tagRows.length > 0) unwrap(await ctx.supabase.from("article_tags").insert(tagRows));
    return { ok: true, message: "Copy created as a draft.", redirectTo: `/admin/articles/${copy.id}` };
  } catch (e) {
    return toActionError(e);
  }
}

// ---------------------------------------------------------------------------
// Save (manual + autosave) with optimistic concurrency on updated_at
// ---------------------------------------------------------------------------
export async function saveArticle(id: string, expectedUpdatedAt: string, formData: FormData, makeRevision: boolean): Promise<SaveResult> {
  try {
    const ctx = await requireAnyPermission(...EDITORS);
    uuid.parse(id);
    const parsed = articleFormSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: issue?.message ?? "Please check the fields.", field: String(issue?.path[0] ?? "") };
    }
    const f = parsed.data;
    const rendered = renderRichText(JSON.parse(f.body));
    const canPlace = ctx.permissions.has("articles.publish") && formData.get("placement_present") === "1";
    const canReassign = ctx.permissions.has("articles.edit_any") && f.author_id;

    const { data: updated, error } = await ctx.supabase
      .from("articles")
      .update({
        title: f.title,
        subtitle: f.subtitle,
        slug: f.slug,
        excerpt: f.excerpt,
        body: rendered.doc as never,
        body_html: rendered.html,
        body_text: rendered.text,
        reading_minutes: rendered.readingMinutes,
        category_id: f.category_id,
        location_id: f.location_id,
        featured_image_id: f.featured_image_id,
        og_image_id: f.og_image_id,
        seo_title: f.seo_title,
        seo_description: f.seo_description,
        canonical_url: f.canonical_url,
        source_attribution: f.source_attribution,
        correction_note: f.correction_note,
        allow_comments: formData.get("allow_comments") === "on",
        ...(canPlace
          ? {
              is_featured: formData.get("is_featured") === "on",
              is_breaking: formData.get("is_breaking") === "on",
              is_editors_pick: formData.get("is_editors_pick") === "on",
            }
          : {}),
        ...(canReassign ? { author_id: f.author_id! } : {}),
      })
      .eq("id", id)
      .eq("updated_at", expectedUpdatedAt)
      .select("updated_at, slug, status, published_at, category_id")
      .maybeSingle();
    if (error) throw error;

    if (!updated) {
      // Either someone saved a newer version, or RLS no longer lets this user edit (e.g. submitted).
      const { data: current } = await ctx.supabase.from("articles").select("updated_at").eq("id", id).maybeSingle();
      if (current && current.updated_at !== expectedUpdatedAt) {
        return { ok: false, conflict: true, error: "A newer version was saved by another user or tab. Your changes were not saved over it." };
      }
      return { ok: false, error: "You can no longer edit this article in its current status." };
    }

    await syncRelations(ctx, id, f);
    if (makeRevision) unwrap(await ctx.supabase.rpc("snapshot_article", { p_article_id: id, p_note: "Manual save" }));
    if (isPublic(updated.status, updated.published_at)) await revalidateArticle(ctx, updated.slug, updated.category_id);
    return { ok: true, updatedAt: updated.updated_at };
  } catch (e) {
    return toActionError(e);
  }
}

type ArticleForm = z.infer<typeof articleFormSchema>;

/** Diff-based sync so a failure mid-way never wipes existing tags/credits wholesale. */
async function syncRelations(ctx: StaffContext, id: string, f: ArticleForm) {
  const db = ctx.supabase;
  const tags = need(await db.from("article_tags").select("tag_id").eq("article_id", id)).map((t) => t.tag_id);
  const removeTags = tags.filter((t) => !f.tag_ids.includes(t));
  const addTags = f.tag_ids.filter((t) => !tags.includes(t));
  if (removeTags.length) unwrap(await db.from("article_tags").delete().eq("article_id", id).in("tag_id", removeTags));
  if (addTags.length) unwrap(await db.from("article_tags").insert(addTags.map((tag_id) => ({ article_id: id, tag_id }))));

  const contributorIds = f.contributors.map((c) => c.profile_id);
  const existingC = need(await db.from("article_contributors").select("profile_id").eq("article_id", id)).map((c) => c.profile_id);
  const removeC = existingC.filter((p) => !contributorIds.includes(p));
  if (removeC.length) unwrap(await db.from("article_contributors").delete().eq("article_id", id).in("profile_id", removeC));
  if (f.contributors.length)
    unwrap(
      await db
        .from("article_contributors")
        .upsert(f.contributors.map((c, position) => ({ article_id: id, profile_id: c.profile_id, role_label: c.role_label, position }))),
    );

  const relatedIds = f.related_ids.filter((r) => r !== id);
  const existingR = need(await db.from("related_articles").select("related_article_id").eq("article_id", id)).map((r) => r.related_article_id);
  const removeR = existingR.filter((r) => !relatedIds.includes(r));
  if (removeR.length) unwrap(await db.from("related_articles").delete().eq("article_id", id).in("related_article_id", removeR));
  if (relatedIds.length)
    unwrap(await db.from("related_articles").upsert(relatedIds.map((related_article_id, position) => ({ article_id: id, related_article_id, position }))));
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------
const transitionSchema = z.object({
  to: z.enum(["draft", "pending_review", "approved", "rejected", "scheduled", "published", "archived"]),
  note: z.string().trim().max(2000, "Note is too long.").optional(),
  publish_at: z.string().optional(),
});

export async function transitionArticle(
  id: string,
  input: { to: string; note?: string; publish_at?: string },
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const ctx = await requireAnyPermission("articles.submit", "articles.review", "articles.publish", "articles.archive", ...EDITORS);
    uuid.parse(id);
    const t = transitionSchema.parse(input);
    let publishAt: string | null = null;
    if (t.to === "scheduled") {
      publishAt = manilaLocalToIso(t.publish_at ?? "");
      if (!publishAt) return { ok: false, error: "Choose a valid date and time for the schedule." };
    }
    const row = need(
      await ctx.supabase.rpc("transition_article", { p_article_id: id, p_to: t.to, p_note: t.note || null, p_publish_at: publishAt }),
    );
    await revalidateArticle(ctx, row.slug, row.category_id);
    return { ok: true, message: "Status updated." };
  } catch (e) {
    return toActionError(e);
  }
}

// ---------------------------------------------------------------------------
// Delete (articles.delete). Live articles must be unpublished/archived first.
// ---------------------------------------------------------------------------
export async function deleteArticle(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("articles.delete");
    const id = uuid.parse(formData.get("id"));
    const a = need(await ctx.supabase.from("articles").select("slug, status, published_at, category_id, title").eq("id", id).single());
    if (formData.get("confirm_title") !== a.title) return { ok: false, error: "Type the exact title to confirm deletion." };
    if (isPublic(a.status, a.published_at) || a.status === "scheduled") {
      return { ok: false, error: "This article is still published or scheduled. Unpublish or archive it before deleting." };
    }
    const deleted = need(await ctx.supabase.from("articles").delete().eq("id", id).select("id"));
    if (deleted.length === 0) return { ok: false, error: "The article was not deleted (you lack permission or it no longer exists)." };
    await revalidateArticle(ctx, a.slug, a.category_id);
    return { ok: true, message: "Article deleted.", redirectTo: "/admin/articles" };
  } catch (e) {
    return toActionError(e);
  }
}

// ---------------------------------------------------------------------------
// Revisions
// ---------------------------------------------------------------------------
const snapshotSchema = z.object({
  title: z.string(),
  subtitle: z.string().nullable(),
  slug: z.string().refine(isValidSlug),
  excerpt: z.string().nullable(),
  body: z.unknown(),
  category_id: z.string().nullable(),
  location_id: z.string().nullable(),
  featured_image_id: z.string().nullable(),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  canonical_url: z.string().nullable(),
  source_attribution: z.string().nullable(),
  correction_note: z.string().nullable(),
  tag_ids: z.array(z.string()).default([]),
});

export async function restoreArticleRevision(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requireAnyPermission(...EDITORS);
    const revisionId = uuid.parse(formData.get("revision_id"));
    const rev = need(await ctx.supabase.from("article_revisions").select("article_id, revision_number, snapshot").eq("id", revisionId).single());
    const s = snapshotSchema.parse(rev.snapshot);
    const rendered = renderRichText(s.body);
    const canEdit = need(await ctx.supabase.rpc("can_edit_article", { p_article_id: rev.article_id }));
    if (!canEdit) return { ok: false, error: "You cannot edit this article in its current status." };
    // Keep the current state recoverable before overwriting it.
    unwrap(await ctx.supabase.rpc("snapshot_article", { p_article_id: rev.article_id, p_note: `Before restoring revision #${rev.revision_number}` }));
    const updated = need(
      await ctx.supabase
        .from("articles")
        .update({
          title: s.title,
          subtitle: s.subtitle,
          slug: s.slug,
          excerpt: s.excerpt,
          body: rendered.doc as never,
          body_html: rendered.html,
          body_text: rendered.text,
          reading_minutes: rendered.readingMinutes,
          category_id: s.category_id,
          location_id: s.location_id,
          featured_image_id: s.featured_image_id,
          seo_title: s.seo_title,
          seo_description: s.seo_description,
          canonical_url: s.canonical_url,
          source_attribution: s.source_attribution,
          correction_note: s.correction_note,
        })
        .eq("id", rev.article_id)
        .select("slug, status, published_at, category_id"),
    );
    if (updated.length === 0) return { ok: false, error: "You cannot edit this article in its current status." };
    const existing = need(await ctx.supabase.from("article_tags").select("tag_id").eq("article_id", rev.article_id)).map((t) => t.tag_id);
    // Tags deleted since the snapshot are skipped.
    const wanted = s.tag_ids.length ? need(await ctx.supabase.from("tags").select("id").in("id", s.tag_ids)).map((t) => t.id) : [];
    const remove = existing.filter((t) => !wanted.includes(t));
    const add = wanted.filter((t) => !existing.includes(t));
    if (remove.length) unwrap(await ctx.supabase.from("article_tags").delete().eq("article_id", rev.article_id).in("tag_id", remove));
    if (add.length) unwrap(await ctx.supabase.from("article_tags").insert(add.map((tag_id) => ({ article_id: rev.article_id, tag_id }))));
    const u = updated[0]!;
    if (isPublic(u.status, u.published_at)) await revalidateArticle(ctx, u.slug, u.category_id);
    return { ok: true, message: `Revision #${rev.revision_number} restored.`, redirectTo: `/admin/articles/${rev.article_id}` };
  } catch (e) {
    return toActionError(e);
  }
}

// ---------------------------------------------------------------------------
// Editor helpers
// ---------------------------------------------------------------------------
export async function searchArticlesForRelated(q: string, excludeId: string): Promise<{ id: string; title: string; status: ArticleStatus }[]> {
  const ctx = await requireAnyPermission(...EDITORS);
  const term = z.string().max(80).parse(q).trim();
  let query = ctx.supabase.from("articles").select("id, title, status").order("updated_at", { ascending: false }).limit(10);
  // An unsaved article (New article editor) has no id yet, so there is nothing to exclude.
  if (excludeId) query = query.neq("id", uuid.parse(excludeId));
  if (term) query = query.ilike("title", safeLike(term));
  return need(await query);
}

const tagSchema = z.object({ name: z.string().trim().min(1, "Enter a tag name.").max(80, "Tag is too long.") });

export async function createTag(name: string): Promise<{ ok: true; tag: { id: string; name: string } } | { ok: false; error: string }> {
  try {
    const ctx = await requirePermission("taxonomy.manage");
    const t = tagSchema.parse({ name });
    const slug = slugify(t.name, 80);
    if (!slug) return { ok: false, error: "Invalid tag name." };
    const existing = unwrap(await ctx.supabase.from("tags").select("id, name").eq("slug", slug).maybeSingle());
    if (existing) return { ok: true, tag: existing };
    const tag = need(await ctx.supabase.from("tags").insert({ name: t.name, slug }).select("id, name").single());
    return { ok: true, tag };
  } catch (e) {
    return toActionError(e);
  }
}
