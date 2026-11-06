"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, type StaffContext } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { checkbox, optionalText, optionalUuid, requiredText } from "@/lib/studio/form";
import { moveId, positionUpdates } from "@/lib/studio/reorder";
import { safeHref } from "@/lib/homepage/blocks";
import type { FormActionResult } from "@/components/studio/action-form";
import { must } from "@/lib/studio/db";

const itemSchema = z.object({
  label: requiredText(1, 60, "Label"),
  label_en: optionalText(60, "English label: up to 60 characters."),
  href: safeHref,
  parent_id: optionalUuid,
  open_in_new_tab: checkbox,
  is_visible: checkbox,
});
const idSchema = z.object({ id: z.uuid() });

const refresh = () => revalidatePath("/", "layout");

/** Dropdown groups are one level deep: a parent must be a top-level item of the same menu. */
async function assertParent(ctx: StaffContext, menuId: string, parentId: string | null, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw new z.ZodError([{ code: "custom", path: ["parent_id"], message: "An item cannot be its own parent.", input: parentId }]);
  const parent = unwrap(await ctx.supabase.from("navigation_items").select("id, menu_id, parent_id").eq("id", parentId).maybeSingle());
  if (!parent || parent.menu_id !== menuId || parent.parent_id !== null) {
    throw new z.ZodError([{ code: "custom", path: ["parent_id"], message: "The parent must be a top-level item in the same menu.", input: parentId }]);
  }
}

async function nextPosition(ctx: StaffContext, menuId: string, parentId: string | null): Promise<number> {
  let q = ctx.supabase.from("navigation_items").select("position").eq("menu_id", menuId).order("position", { ascending: false }).limit(1);
  q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
  const rows = must(await q);
  return (rows[0]?.position ?? -10) + 10;
}

export async function createNavItem(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("navigation.manage");
    const { menu_id } = z.object({ menu_id: z.uuid() }).parse({ menu_id: fd.get("menu_id") });
    const input = itemSchema.parse(Object.fromEntries(fd));
    await assertParent(ctx, menu_id, input.parent_id);
    const position = await nextPosition(ctx, menu_id, input.parent_id);
    unwrap(await ctx.supabase.from("navigation_items").insert({ ...input, menu_id, position }));
    refresh();
    return { ok: true, message: "Link added." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateNavItem(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("navigation.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    const input = itemSchema.parse(Object.fromEntries(fd));
    const item = must(await ctx.supabase.from("navigation_items").select("id, menu_id, parent_id").eq("id", id).single());
    await assertParent(ctx, item.menu_id, input.parent_id, id);
    if (input.parent_id) {
      const children = must(await ctx.supabase.from("navigation_items").select("id").eq("parent_id", id).limit(1));
      if (children.length > 0) return { ok: false, error: "This link has sub-items, so it can't be placed under another link." };
    }
    const moved = input.parent_id !== item.parent_id;
    const position = moved ? await nextPosition(ctx, item.menu_id, input.parent_id) : undefined;
    unwrap(await ctx.supabase.from("navigation_items").update({ ...input, ...(position !== undefined ? { position } : {}) }).eq("id", id));
    refresh();
    return { ok: true, message: "Link saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleNavItem(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("navigation.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    const item = must(await ctx.supabase.from("navigation_items").select("is_visible").eq("id", id).single());
    unwrap(await ctx.supabase.from("navigation_items").update({ is_visible: !item.is_visible }).eq("id", id));
    refresh();
    return { ok: true, message: item.is_visible ? "Hidden." : "Now visible." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function moveNavItem(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("navigation.manage");
    const { id, direction } = z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) }).parse(Object.fromEntries(fd));
    const item = must(await ctx.supabase.from("navigation_items").select("menu_id, parent_id").eq("id", id).single());
    let q = ctx.supabase.from("navigation_items").select("id, position").eq("menu_id", item.menu_id).order("position").order("created_at");
    q = item.parent_id ? q.eq("parent_id", item.parent_id) : q.is("parent_id", null);
    const siblings = must(await q);
    const updates = positionUpdates(siblings, moveId(siblings.map((s) => s.id), id, direction));
    for (const u of updates) unwrap(await ctx.supabase.from("navigation_items").update({ position: u.position }).eq("id", u.id));
    refresh();
    return { ok: true, message: "Moved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteNavItem(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("navigation.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    unwrap(await ctx.supabase.from("navigation_items").delete().eq("id", id));
    refresh();
    return { ok: true, message: "Link removed." };
  } catch (e) {
    return toActionError(e);
  }
}
