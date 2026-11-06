"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { slugify } from "@/lib/format";
import { must } from "@/lib/studio/db";
import { checkbox, optionalText, optionalUuid, requiredText, slugField } from "@/lib/studio/form";
import { moveId, positionUpdates } from "@/lib/studio/reorder";
import type { FormActionResult } from "@/components/studio/action-form";

/** Taxonomy feeds the public header, topic bar, archives and /paksa: refresh the whole site tree. */
function revalidateSite() {
  revalidatePath("/", "layout");
}

const categorySchema = z.object({
  id: optionalUuid,
  name: requiredText(1, 80, "Name"),
  slug: slugField,
  description: optionalText(600),
  image_id: optionalUuid,
  seo_title: optionalText(120),
  seo_description: optionalText(320),
  is_featured: checkbox,
  is_active: checkbox,
});

export async function saveCategory(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("taxonomy.manage");
    const { id, ...input } = categorySchema.parse(Object.fromEntries(fd));
    const row = { ...input, slug: input.slug || slugify(input.name, 80) };
    if (id) {
      must(await ctx.supabase.from("categories").update(row).eq("id", id).select("id").single());
      revalidateSite();
      return { ok: true, message: "Category saved." };
    }
    const last = must(await ctx.supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1));
    const created = must(
      await ctx.supabase
        .from("categories")
        .insert({ ...row, sort_order: (last[0]?.sort_order ?? -10) + 10 })
        .select("id")
        .single(),
    );
    revalidateSite();
    return { ok: true, message: "Category created.", redirectTo: `/admin/taxonomy/categories/${created.id}` };
  } catch (e) {
    return toActionError(e);
  }
}

const categoryOpSchema = z.object({ id: z.uuid(), op: z.enum(["up", "down", "toggle", "delete"]) });

export async function categoryOp(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("taxonomy.manage");
    const { id, op } = categoryOpSchema.parse(Object.fromEntries(fd));
    if (op === "toggle") {
      const cat = must(await ctx.supabase.from("categories").select("is_active").eq("id", id).single());
      must(await ctx.supabase.from("categories").update({ is_active: !cat.is_active }).eq("id", id).select("id").single());
      revalidateSite();
      return { ok: true, message: cat.is_active ? "Category hidden from the public site." : "Category is now active." };
    }
    if (op === "delete") {
      const { count } = await ctx.supabase.from("articles").select("id", { count: "exact", head: true }).eq("category_id", id);
      if (count) return { ok: false, error: `Can't delete: used by ${count} ${count === 1 ? "article" : "articles"}. Move the articles first, or deactivate the category instead.` };
      // articles.category_id is ON DELETE RESTRICT, so articles hidden from this session still block deletion (23503).
      unwrap(await ctx.supabase.from("categories").delete().eq("id", id));
      revalidateSite();
      return { ok: true, message: "Category deleted.", redirectTo: "/admin/taxonomy" };
    }
    const rows = must(await ctx.supabase.from("categories").select("id, sort_order").order("sort_order").order("name"));
    const ordered = rows.map((r) => ({ id: r.id, position: r.sort_order }));
    for (const u of positionUpdates(ordered, moveId(ordered.map((r) => r.id), id, op))) {
      unwrap(await ctx.supabase.from("categories").update({ sort_order: u.position }).eq("id", u.id));
    }
    revalidateSite();
    return { ok: true, message: "Order updated." };
  } catch (e) {
    return toActionError(e);
  }
}

const tagSchema = z.object({
  id: optionalUuid,
  name: requiredText(1, 80, "Name"),
  slug: slugField,
  description: optionalText(600),
});

export async function saveTag(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("taxonomy.manage");
    const { id, ...input } = tagSchema.parse(Object.fromEntries(fd));
    const row = { ...input, slug: input.slug || slugify(input.name, 80) };
    if (id) must(await ctx.supabase.from("tags").update(row).eq("id", id).select("id").single());
    else unwrap(await ctx.supabase.from("tags").insert(row));
    revalidateSite();
    return { ok: true, message: id ? "Tag saved." : "Tag created." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteTag(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("taxonomy.manage");
    const id = z.uuid().parse(fd.get("id"));
    // article_tags rows cascade; trending topics pointing at this tag cascade too (confirmed in the UI).
    unwrap(await ctx.supabase.from("tags").delete().eq("id", id));
    revalidateSite();
    return { ok: true, message: "Tag deleted." };
  } catch (e) {
    return toActionError(e);
  }
}
