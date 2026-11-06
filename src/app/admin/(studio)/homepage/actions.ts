"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { toActionError } from "@/lib/actions";
import type { Json } from "@/lib/database.types";
import type { FormActionResult } from "@/components/studio/action-form";
import { BLOCK_LABELS, BLOCK_TYPES, defaultSettings, isBlockType } from "@/lib/homepage/blocks";
import { getDraftConfigId, listSections, settingsIssues, validateSettings } from "@/lib/studio/homepage";

const NOT_DRAFT = "Hindi na-save: wala na sa draft ang section na ito. I-refresh ang pahina.";
const id = z.uuid("Hindi wastong section.");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Hanggang ${max} karakter lamang.`)
    .transform((v) => (v === "" ? null : v));

function done(message: string): FormActionResult {
  revalidatePath("/admin/homepage");
  revalidatePath("/admin/preview/homepage");
  return { ok: true, message };
}

/** Creates the working draft (copy of the published version when one exists). */
export async function createDraft(): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("homepage.manage");
    if (await getDraftConfigId(ctx)) return done("May draft na.");
    const { data: pub, error } = await ctx.supabase.from("homepage_configurations").select("id").eq("status", "published").maybeSingle();
    if (error) throw error;
    if (pub) {
      const r = await ctx.supabase.rpc("restore_homepage_to_draft", { p_configuration_id: pub.id });
      if (r.error) throw r.error;
    } else {
      const r = await ctx.supabase.from("homepage_configurations").insert({ status: "draft", label: "Working draft", updated_by: ctx.userId });
      if (r.error) throw r.error;
    }
    return done("Nagawa ang draft.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function addSection(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("homepage.manage");
    const type = z.enum(BLOCK_TYPES, "Pumili ng uri ng block.").parse(formData.get("block_type"));
    const draftId = await getDraftConfigId(ctx);
    if (!draftId) return { ok: false, error: "Walang draft na homepage. Gumawa muna ng draft." };
    const sections = await listSections(ctx, draftId);
    const settings = defaultSettings(type);
    // Quote/quiz defaults are intentionally incomplete (no fake content): they start disabled until filled in.
    const valid = validateSettings(type, settings).success;
    const { error } = await ctx.supabase.from("homepage_sections").insert({
      configuration_id: draftId,
      block_type: type,
      position: (sections.at(-1)?.position ?? 0) + 1,
      is_enabled: valid,
      settings: settings as Json,
    });
    if (error) throw error;
    return done(valid ? `Naidagdag ang ${BLOCK_LABELS[type]}.` : `Naidagdag ang ${BLOCK_LABELS[type]} (naka-disable hanggang makumpleto ang settings).`);
  } catch (e) {
    return toActionError(e);
  }
}

const updateSchema = z.object({
  id,
  title: optionalText(200),
  description: optionalText(600),
  settings: z.string().max(100_000, "Masyadong malaki ang settings."),
});

export async function updateSection(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("homepage.manage");
    const input = updateSchema.parse(Object.fromEntries(formData));
    // The block type comes from the database row, never from the client.
    const { data: row, error: readError } = await ctx.supabase.from("homepage_sections").select("block_type").eq("id", input.id).maybeSingle();
    if (readError) throw readError;
    if (!row || !isBlockType(row.block_type)) return { ok: false, error: NOT_DRAFT };
    let raw: unknown;
    try {
      raw = JSON.parse(input.settings);
    } catch {
      return { ok: false, error: "Hindi mabasa ang settings." };
    }
    const parsed = validateSettings(row.block_type, raw);
    if (!parsed.success) {
      const i = parsed.error.issues[0]!;
      return { ok: false, error: `${i.path.join(".") || "settings"}: ${i.message}` };
    }
    const { data, error } = await ctx.supabase
      .from("homepage_sections")
      .update({ title: input.title, description: input.description, settings: parsed.data as Json })
      .eq("id", input.id)
      .select("id");
    if (error) throw error;
    if (!data?.length) return { ok: false, error: NOT_DRAFT };
    return done("Na-save ang section sa draft.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function toggleSection(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("homepage.manage");
    const sectionId = id.parse(formData.get("id"));
    const enable = formData.get("enable") === "1";
    if (enable) {
      const { data: row, error } = await ctx.supabase.from("homepage_sections").select("block_type, settings").eq("id", sectionId).maybeSingle();
      if (error) throw error;
      if (!row) return { ok: false, error: NOT_DRAFT };
      const issues = settingsIssues(row.block_type, row.settings);
      if (issues.length) return { ok: false, error: `Kumpletuhin muna ang settings: ${issues[0]}` };
    }
    const { data, error } = await ctx.supabase.from("homepage_sections").update({ is_enabled: enable }).eq("id", sectionId).select("id");
    if (error) throw error;
    if (!data?.length) return { ok: false, error: NOT_DRAFT };
    return done(enable ? "Naka-enable ang section." : "Naka-disable ang section.");
  } catch (e) {
    return toActionError(e);
  }
}

/** Swap with the neighbour, then renumber the whole draft 1..n so positions stay contiguous. */
export async function moveSection(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("homepage.manage");
    const sectionId = id.parse(formData.get("id"));
    const dir = z.enum(["up", "down"]).parse(formData.get("dir"));
    const draftId = await getDraftConfigId(ctx);
    if (!draftId) return { ok: false, error: NOT_DRAFT };
    const order = (await listSections(ctx, draftId)).map((s) => ({ id: s.id, position: s.position }));
    const i = order.findIndex((s) => s.id === sectionId);
    if (i < 0) return { ok: false, error: NOT_DRAFT };
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= order.length) return done("Nasa dulo na ang section.");
    const ids = order.map((s) => s.id);
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    const current = new Map(order.map((s) => [s.id, s.position]));
    for (const [idx, sid] of ids.entries()) {
      if (current.get(sid) === idx + 1) continue;
      const { error } = await ctx.supabase.from("homepage_sections").update({ position: idx + 1 }).eq("id", sid);
      if (error) throw error;
    }
    return done("Nailipat ang section.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteSection(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("homepage.manage");
    const sectionId = id.parse(formData.get("id"));
    const { data, error } = await ctx.supabase.from("homepage_sections").delete().eq("id", sectionId).select("id");
    if (error) throw error;
    if (!data?.length) return { ok: false, error: NOT_DRAFT };
    return done("Natanggal ang section sa draft.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function publishHomepage(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("homepage.manage");
    const label = optionalText(200).parse(formData.get("label") ?? "");
    const draftId = await getDraftConfigId(ctx);
    if (!draftId) return { ok: false, error: "Walang draft na homepage." };
    const sections = await listSections(ctx, draftId);
    const enabled = sections.filter((s) => s.is_enabled);
    if (enabled.length === 0) return { ok: false, error: "Walang naka-enable na section; hindi ipa-publish ang blangkong homepage." };
    const broken = enabled.find((s) => settingsIssues(s.block_type, s.settings).length > 0);
    if (broken) return { ok: false, error: `May hindi wastong settings ang "${broken.title ?? broken.block_type}". Ayusin o i-disable muna.` };
    const { error } = await ctx.supabase.rpc("publish_homepage", { p_label: label });
    if (error) throw error;
    revalidatePath("/");
    return done("Na-publish ang homepage.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function restoreConfiguration(_prev: FormActionResult, formData: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("homepage.manage");
    const configId = id.parse(formData.get("id"));
    const { error } = await ctx.supabase.rpc("restore_homepage_to_draft", { p_configuration_id: configId });
    if (error) {
      if (error.message === "configuration_not_found") return { ok: false, error: "Hindi nahanap ang bersyong ito." };
      throw error;
    }
    return done("Naibalik sa draft. Suriin ang preview bago i-publish.");
  } catch (e) {
    return toActionError(e);
  }
}
