"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, type StaffContext } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { must } from "@/lib/studio/db";
import { moveId, positionUpdates } from "@/lib/studio/reorder";
import { surveyEntryInputSchema, surveyInputSchema } from "@/lib/studio/surveys";
import type { FormActionResult } from "@/components/studio/action-form";

const idSchema = z.object({ id: z.uuid() });
const surveyIdSchema = z.object({ survey_id: z.uuid() });
const POSITION_STEP = 10;

// The surveys band sits on the homepage only.
const revalidatePublic = () => revalidatePath("/");

function parseSurvey(fd: FormData) {
  return surveyInputSchema.parse({
    title: fd.get("title"),
    scope: fd.get("scope"),
    subtitle: fd.get("subtitle"),
    note: fd.get("note"),
    survey_date: fd.get("survey_date"),
    is_published: fd.get("is_published"),
    show_on_homepage: fd.get("show_on_homepage"),
    sort_order: fd.get("sort_order") || 0,
  });
}

function parseEntry(fd: FormData) {
  return surveyEntryInputSchema.parse({
    name: fd.get("name"),
    area: fd.get("area"),
    rank_no: fd.get("rank_no"),
    overall_pct: fd.get("overall_pct"),
    trust_pct: fd.get("trust_pct"),
    performance_pct: fd.get("performance_pct"),
    photo_id: fd.get("photo_id"),
    photo_x: fd.get("photo_x"),
    photo_y: fd.get("photo_y"),
    photo_zoom: fd.get("photo_zoom"),
  });
}

/** The card renders the photo as an <img>, so it must be an image asset with a public URL. */
async function assertImage(ctx: StaffContext, photoId: string | null) {
  if (!photoId) return;
  const { data, error } = await ctx.supabase.from("media_assets").select("kind, storage_path").eq("id", photoId).maybeSingle();
  if (error) throw error;
  // An uploaded image only: the site's image optimizer serves files from our storage, not from arbitrary links.
  if (data?.kind !== "image" || !data.storage_path) {
    throw new z.ZodError([{ code: "custom", path: ["photo_id"], message: "Choose or upload an image.", input: photoId }]);
  }
}

export async function createSurvey(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("surveys.manage");
    const input = parseSurvey(fd);
    const row = must(await ctx.supabase.from("surveys").insert({ ...input, created_by: ctx.userId, updated_by: ctx.userId }).select("id").single());
    revalidatePublic();
    return { ok: true, message: "Survey created. Add the candidates next.", redirectTo: `/admin/surveys/${row.id}` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateSurvey(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("surveys.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    const input = parseSurvey(fd);
    must(await ctx.supabase.from("surveys").update({ ...input, updated_by: ctx.userId }).eq("id", id).select("id").single());
    revalidatePublic();
    return { ok: true, message: "Survey saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleSurveyPublished(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("surveys.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    // The button says what it will do ("publish" = true); a second click on a stale list cannot flip it back by mistake.
    const publish = fd.get("publish") === "true";
    unwrap(await ctx.supabase.from("surveys").update({ is_published: publish, updated_by: ctx.userId }).eq("id", id));
    revalidatePublic();
    return { ok: true, message: publish ? "Survey published." : "Survey unpublished." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteSurvey(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("surveys.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    const deleted = unwrap(await ctx.supabase.from("surveys").delete().eq("id", id).select("id"));
    // RLS lets only the survey's creator and editors and above delete it; anyone else matches no row.
    if (!deleted || deleted.length === 0) return { ok: false, error: "Only the person who created this survey, or an editor, can delete it." };
    revalidatePublic();
    return { ok: true, message: "Survey deleted.", redirectTo: "/admin/surveys" };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addSurveyEntry(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("surveys.manage");
    const { survey_id } = surveyIdSchema.parse({ survey_id: fd.get("survey_id") });
    const input = parseEntry(fd);
    await assertImage(ctx, input.photo_id);
    const { data: last, error } = await ctx.supabase
      .from("survey_entries")
      .select("position")
      .eq("survey_id", survey_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    unwrap(await ctx.supabase.from("survey_entries").insert({ ...input, survey_id, position: (last?.position ?? -POSITION_STEP) + POSITION_STEP }));
    revalidatePublic();
    return { ok: true, message: "Candidate added." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateSurveyEntry(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("surveys.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    const input = parseEntry(fd);
    await assertImage(ctx, input.photo_id);
    must(await ctx.supabase.from("survey_entries").update(input).eq("id", id).select("id").single());
    revalidatePublic();
    return { ok: true, message: "Candidate saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteSurveyEntry(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("surveys.manage");
    const { id } = idSchema.parse({ id: fd.get("id") });
    must(await ctx.supabase.from("survey_entries").delete().eq("id", id).select("id").single());
    revalidatePublic();
    return { ok: true, message: "Candidate removed." };
  } catch (e) {
    return toActionError(e);
  }
}

async function loadOrder(ctx: StaffContext, surveyId: string) {
  const { data, error } = await ctx.supabase
    .from("survey_entries")
    .select("id, position, overall_pct, created_at")
    .eq("survey_id", surveyId)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

/** Stores `newOrder` as positions 0, 10, 20, … touching only the rows whose position changes. */
async function saveOrder(ctx: StaffContext, rows: { id: string; position: number }[], newOrder: string[]) {
  for (const u of positionUpdates(rows, newOrder)) {
    unwrap(await ctx.supabase.from("survey_entries").update({ position: u.position }).eq("id", u.id));
  }
}

const moveSchema = z.object({ survey_id: z.uuid(), id: z.uuid(), direction: z.enum(["up", "down"]) });

export async function moveSurveyEntry(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("surveys.manage");
    const { survey_id, id, direction } = moveSchema.parse({ survey_id: fd.get("survey_id"), id: fd.get("id"), direction: fd.get("direction") });
    const rows = await loadOrder(ctx, survey_id);
    await saveOrder(ctx, rows, moveId(rows.map((r) => r.id), id, direction));
    revalidatePublic();
    return { ok: true, message: "Order updated." };
  } catch (e) {
    return toActionError(e);
  }
}

/** Highest overall score first; cards without a score keep their relative order at the end. */
export async function sortSurveyEntriesByScore(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("surveys.manage");
    const { survey_id } = surveyIdSchema.parse({ survey_id: fd.get("survey_id") });
    const rows = await loadOrder(ctx, survey_id);
    const sorted = rows
      .map((r, i) => ({ r, i }))
      .sort((a, b) => (b.r.overall_pct ?? -1) - (a.r.overall_pct ?? -1) || a.i - b.i)
      .map(({ r }) => r.id);
    await saveOrder(ctx, rows, sorted);
    revalidatePublic();
    return { ok: true, message: "Sorted by overall score." };
  } catch (e) {
    return toActionError(e);
  }
}
