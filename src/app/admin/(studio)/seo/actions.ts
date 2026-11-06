"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, type StaffContext } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { siteUrl } from "@/lib/env";
import { createsLoop, redirectInputSchema } from "@/lib/studio/redirects";
import { saveSettingsFromForm, SettingsValidationError } from "@/lib/studio/settings";
import type { FormActionResult } from "@/components/studio/action-form";
import { must } from "@/lib/studio/db";

const idSchema = z.object({ id: z.uuid() });

function fail(e: unknown): FormActionResult {
  if (e instanceof SettingsValidationError) return { ok: false, error: e.message };
  if ((e as { code?: string } | null)?.code === "23505") return { ok: false, error: "A redirect already exists for this source path." };
  return toActionError(e);
}

export async function saveSeoSettings(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("seo.manage");
    await saveSettingsFromForm(ctx, "seo", fd);
    revalidatePath("/", "layout");
    return { ok: true, message: "Global SEO saved." };
  } catch (e) {
    return fail(e);
  }
}

function parseRedirect(fd: FormData) {
  return redirectInputSchema.parse({
    source_path: fd.get("source_path"),
    destination: fd.get("destination"),
    status_code: fd.get("status_code"),
    is_active: fd.get("is_active") === "on",
  });
}

/** Reject redirects that would bounce visitors in a circle (A→A, A→B→A, …). */
async function assertNoLoop(ctx: StaffContext, input: { source_path: string; destination: string; is_active: boolean }, selfId?: string) {
  if (!input.is_active) return;
  let q = ctx.supabase.from("redirects").select("source_path, destination").eq("is_active", true);
  if (selfId) q = q.neq("id", selfId);
  const existing = must(await q);
  if (createsLoop(input.source_path, input.destination, existing, new URL(siteUrl("/")).origin)) {
    throw new z.ZodError([{ code: "custom", path: ["destination"], message: "This would cause a redirect loop. Check the destination.", input: input.destination }]);
  }
}

export async function createRedirect(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("seo.manage");
    const input = parseRedirect(fd);
    await assertNoLoop(ctx, input);
    unwrap(await ctx.supabase.from("redirects").insert({ ...input, created_by: ctx.userId }));
    revalidatePath("/", "layout");
    return { ok: true, message: "Redirect added." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateRedirect(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("seo.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    const input = parseRedirect(fd);
    await assertNoLoop(ctx, input, id);
    unwrap(await ctx.supabase.from("redirects").update(input).eq("id", id));
    revalidatePath("/", "layout");
    return { ok: true, message: "Redirect saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleRedirect(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("seo.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    const row = must(await ctx.supabase.from("redirects").select("source_path, destination, is_active").eq("id", id).single());
    if (!row.is_active) await assertNoLoop(ctx, { ...row, is_active: true }, id);
    unwrap(await ctx.supabase.from("redirects").update({ is_active: !row.is_active }).eq("id", id));
    revalidatePath("/", "layout");
    return { ok: true, message: row.is_active ? "Disabled." : "Enabled." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRedirect(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("seo.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    unwrap(await ctx.supabase.from("redirects").delete().eq("id", id));
    revalidatePath("/", "layout");
    return { ok: true, message: "Redirect removed." };
  } catch (e) {
    return fail(e);
  }
}
