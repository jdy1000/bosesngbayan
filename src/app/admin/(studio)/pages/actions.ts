"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { need } from "../articles/db";
import type { FormActionResult } from "@/components/studio/action-form";
import { isValidSlug, slugify } from "@/lib/format";
import { renderRichText } from "@/lib/rich-text/render";
import { canonicalUrl, optText, optUuid, slugField, type SaveResult } from "../articles/schema";

const uuid = z.uuid("Hindi wastong ID.");

const pageFormSchema = z.object({
  title: z.string().trim().min(1, "Ilagay ang pamagat.").max(200, "Pamagat: hanggang 200 karakter lamang."),
  slug: slugField(120),
  summary: optText(600, "Buod"),
  body: z.string().max(2_000_000, "Masyadong mahaba ang nilalaman."),
  seo_title: optText(120, "SEO title"),
  seo_description: optText(320, "SEO description"),
  canonical_url: canonicalUrl,
  og_image_id: optUuid,
});

function revalidatePage(...slugs: string[]) {
  for (const s of new Set(slugs)) revalidatePath(`/${s}`);
  revalidatePath("/sitemap.xml");
}

export async function createPage(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("pages.manage");
    const title = z.string().trim().min(1, "Ilagay ang pamagat.").max(200, "Masyadong mahaba ang pamagat.").parse(formData.get("title") ?? "");
    const slug = slugify(title, 120);
    if (!slug) return { ok: false, error: "Gumamit ng pamagat na may titik o numero." };
    const row = need(
      await ctx.supabase.from("pages").insert({ title, slug, created_by: ctx.userId, updated_by: ctx.userId }).select("id").single(),
    );
    return { ok: true, message: "Nagawa ang pahina.", redirectTo: `/admin/pages/${row.id}` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function savePage(id: string, expectedUpdatedAt: string, formData: FormData, makeRevision: boolean): Promise<SaveResult> {
  try {
    const ctx = await requirePermission("pages.manage");
    uuid.parse(id);
    const parsed = pageFormSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: issue?.message ?? "Pakisuri ang mga field.", field: String(issue?.path[0] ?? "") };
    }
    const f = parsed.data;
    const rendered = renderRichText(JSON.parse(f.body));
    const before = need(await ctx.supabase.from("pages").select("slug").eq("id", id).single());
    const { data: updated, error } = await ctx.supabase
      .from("pages")
      .update({
        title: f.title,
        slug: f.slug,
        summary: f.summary,
        body: rendered.doc as never,
        body_html: rendered.html,
        body_text: rendered.text,
        seo_title: f.seo_title,
        seo_description: f.seo_description,
        canonical_url: f.canonical_url,
        og_image_id: f.og_image_id,
        robots_noindex: formData.get("robots_noindex") === "on",
        updated_by: ctx.userId,
      })
      .eq("id", id)
      .eq("updated_at", expectedUpdatedAt)
      .select("updated_at, status, slug")
      .maybeSingle();
    if (error) throw error;
    if (!updated) {
      return { ok: false, conflict: true, error: "May mas bagong bersyon na na-save ng ibang user o tab. Hindi ito pinatungan." };
    }
    if (makeRevision) unwrap(await ctx.supabase.rpc("snapshot_page", { p_page_id: id, p_note: "Manwal na pag-save" }));
    if (updated.status === "published") revalidatePage(before.slug, updated.slug);
    return { ok: true, updatedAt: updated.updated_at };
  } catch (e) {
    return toActionError(e);
  }
}

const statusSchema = z.object({ id: uuid, to: z.enum(["draft", "published", "archived"]) });

export async function setPageStatus(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("pages.manage");
    const { id, to } = statusSchema.parse({ id: formData.get("id"), to: formData.get("to") });
    const page = need(await ctx.supabase.from("pages").select("slug, status, published_at, body_text").eq("id", id).single());
    if (page.status === to) return { ok: false, error: "Ito na ang kasalukuyang status." };
    if (to === "published" && !page.body_text.trim()) return { ok: false, error: "Walang laman ang pahina. I-save muna ang nilalaman." };
    unwrap(
      await ctx.supabase
        .from("pages")
        .update({ status: to, published_at: to === "published" ? (page.published_at ?? new Date().toISOString()) : page.published_at, updated_by: ctx.userId })
        .eq("id", id),
    );
    unwrap(await ctx.supabase.rpc("snapshot_page", { p_page_id: id, p_note: `Status: ${to}` }));
    revalidatePage(page.slug);
    return { ok: true, message: to === "published" ? "Nailathala ang pahina." : "Na-update ang status." };
  } catch (e) {
    return toActionError(e);
  }
}

const snapshotSchema = z.object({
  title: z.string(),
  slug: z.string().refine(isValidSlug),
  summary: z.string().nullable(),
  body: z.unknown(),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
});

export async function restorePageRevision(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("pages.manage");
    const revisionId = uuid.parse(formData.get("revision_id"));
    const rev = need(await ctx.supabase.from("page_revisions").select("page_id, revision_number, snapshot").eq("id", revisionId).single());
    const s = snapshotSchema.parse(rev.snapshot);
    const rendered = renderRichText(s.body);
    const before = need(await ctx.supabase.from("pages").select("slug, status").eq("id", rev.page_id).single());
    unwrap(await ctx.supabase.rpc("snapshot_page", { p_page_id: rev.page_id, p_note: `Bago i-restore ang rebisyon #${rev.revision_number}` }));
    unwrap(
      await ctx.supabase
        .from("pages")
        .update({
          title: s.title,
          slug: s.slug,
          summary: s.summary,
          body: rendered.doc as never,
          body_html: rendered.html,
          body_text: rendered.text,
          seo_title: s.seo_title,
          seo_description: s.seo_description,
          updated_by: ctx.userId,
        })
        .eq("id", rev.page_id),
    );
    if (before.status === "published") revalidatePage(before.slug, s.slug);
    return { ok: true, message: `Naibalik ang rebisyon #${rev.revision_number}.`, redirectTo: `/admin/pages/${rev.page_id}` };
  } catch (e) {
    return toActionError(e);
  }
}
