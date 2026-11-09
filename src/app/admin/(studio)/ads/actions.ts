"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, type StaffContext } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { must } from "@/lib/studio/db";
import { adSlotInputSchema } from "@/lib/studio/ads";
import type { FormActionResult } from "@/components/studio/action-form";

const idSchema = z.object({ id: z.uuid() });

function parseAd(fd: FormData) {
  return adSlotInputSchema.parse({
    name: fd.get("name"),
    placement: fd.get("placement"),
    image_id: fd.get("image_id"),
    alt_text: fd.get("alt_text"),
    destination_url: fd.get("destination_url"),
    is_active: fd.get("is_active"),
    starts_at: fd.get("starts_at"),
    ends_at: fd.get("ends_at"),
    sort_order: fd.get("sort_order") || 0,
  });
}

/** Ads render as <img>, so the creative must be an image asset with a public URL. */
async function assertImage(ctx: StaffContext, imageId: string) {
  const { data, error } = await ctx.supabase.from("media_assets").select("kind").eq("id", imageId).maybeSingle();
  if (error) throw error;
  if (data?.kind !== "image") {
    throw new z.ZodError([{ code: "custom", path: ["image_id"], message: "Choose or upload an image.", input: imageId }]);
  }
}

// Ads appear on the homepage and every article page.
const revalidatePublic = () => revalidatePath("/", "layout");

export async function createAdSlot(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("ads.manage");
    const input = parseAd(fd);
    await assertImage(ctx, input.image_id);
    unwrap(await ctx.supabase.from("ad_slots").insert({ ...input, created_by: ctx.userId, updated_by: ctx.userId }));
    revalidatePublic();
    return { ok: true, message: input.is_active ? "Ad created and activated." : "Ad created (inactive)." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateAdSlot(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("ads.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    const input = parseAd(fd);
    await assertImage(ctx, input.image_id);
    must(await ctx.supabase.from("ad_slots").update({ ...input, updated_by: ctx.userId }).eq("id", id).select("id").single());
    revalidatePublic();
    return { ok: true, message: "Ad saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleAdSlot(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("ads.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    const row = must(await ctx.supabase.from("ad_slots").select("is_active").eq("id", id).single());
    unwrap(await ctx.supabase.from("ad_slots").update({ is_active: !row.is_active, updated_by: ctx.userId }).eq("id", id));
    revalidatePublic();
    return { ok: true, message: row.is_active ? "Ad deactivated." : "Ad activated." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteAdSlot(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("ads.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    must(await ctx.supabase.from("ad_slots").delete().eq("id", id).select("id").single());
    revalidatePublic();
    return { ok: true, message: "Ad deleted." };
  } catch (e) {
    return toActionError(e);
  }
}
