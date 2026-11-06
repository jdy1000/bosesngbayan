"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { slugify } from "@/lib/format";
import { must } from "@/lib/studio/db";
import { checkbox, optionalUuid, requiredText, slugField } from "@/lib/studio/form";
import { moveId, positionUpdates } from "@/lib/studio/reorder";
import type { FormActionResult } from "@/components/studio/action-form";
import { LOCATION_KINDS, PARENT_KIND } from "./location-kinds";

function revalidateSite() {
  revalidatePath("/", "layout");
}

const locationSchema = z.object({
  id: optionalUuid,
  name: requiredText(1, 120, "Pangalan"),
  slug: slugField,
  kind: z.enum(LOCATION_KINDS),
  parent_id: optionalUuid,
  sort_order: z.coerce.number().int().min(-100000).max(100000).default(0),
  is_active: checkbox,
});

export async function saveLocation(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("taxonomy.manage");
    const { id, ...input } = locationSchema.parse(Object.fromEntries(fd));
    const expectedParent = PARENT_KIND[input.kind];
    if (!expectedParent && input.parent_id) return { ok: false, error: "Ang island group ay walang parent." };
    if (expectedParent) {
      if (!input.parent_id) return { ok: false, error: "Pumili ng parent na lokasyon." };
      if (input.parent_id === id) return { ok: false, error: "Hindi maaaring maging parent ang sarili." };
      const parent = must(await ctx.supabase.from("locations").select("kind").eq("id", input.parent_id).single());
      if (parent.kind !== expectedParent) return { ok: false, error: "Hindi tugma ang uri ng parent (island group → region → province → city)." };
    }
    if (id) {
      const current = must(await ctx.supabase.from("locations").select("kind").eq("id", id).single());
      if (current.kind !== input.kind) {
        const { count } = await ctx.supabase.from("locations").select("id", { count: "exact", head: true }).eq("parent_id", id);
        if (count) return { ok: false, error: "Hindi mababago ang uri habang may mga sakop na lokasyon." };
      }
    }
    const row = { ...input, slug: input.slug || slugify(input.name, 120) };
    if (id) must(await ctx.supabase.from("locations").update(row).eq("id", id).select("id").single());
    else unwrap(await ctx.supabase.from("locations").insert(row));
    revalidateSite();
    return { ok: true, message: id ? "Na-save ang lokasyon." : "Nagawa ang lokasyon." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteLocation(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("taxonomy.manage");
    const id = z.uuid().parse(fd.get("id"));
    const [children, articles] = await Promise.all([
      ctx.supabase.from("locations").select("id", { count: "exact", head: true }).eq("parent_id", id),
      ctx.supabase.from("articles").select("id", { count: "exact", head: true }).eq("location_id", id),
    ]);
    if (children.count) return { ok: false, error: `Hindi mabubura: may ${children.count} sakop na lokasyon.` };
    // articles.location_id is ON DELETE SET NULL; block anyway so stories never silently lose their place.
    if (articles.count) return { ok: false, error: `Hindi mabubura: ginagamit ng ${articles.count} artikulo. I-deactivate na lamang.` };
    unwrap(await ctx.supabase.from("locations").delete().eq("id", id));
    revalidateSite();
    return { ok: true, message: "Nabura ang lokasyon." };
  } catch (e) {
    return toActionError(e);
  }
}

const trendingSchema = z.object({
  id: optionalUuid,
  label: requiredText(1, 60, "Label"),
  target: z.enum(["category", "tag", "href"]),
  category_id: optionalUuid,
  tag_id: optionalUuid,
  href: z.string().trim().max(500).optional(),
  is_active: checkbox,
});

export async function saveTrending(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("taxonomy.manage");
    const { id, target, ...input } = trendingSchema.parse(Object.fromEntries(fd));
    // Exactly one destination (DB check: num_nonnulls(category_id, tag_id, href) = 1).
    const dest = {
      category_id: target === "category" ? input.category_id : null,
      tag_id: target === "tag" ? input.tag_id : null,
      href: target === "href" ? input.href || null : null,
    };
    if (!dest.category_id && !dest.tag_id && !dest.href) return { ok: false, error: "Pumili ng kategorya, tag o internal na link." };
    if (dest.href && !/^\/[^/\\]/.test(dest.href)) return { ok: false, error: "Ang link ay dapat internal na path na nagsisimula sa “/” (hal. /paksa/kalusugan)." };
    const row = { label: input.label, is_active: input.is_active, ...dest };
    if (id) {
      must(await ctx.supabase.from("trending_topics").update(row).eq("id", id).select("id").single());
    } else {
      const last = must(await ctx.supabase.from("trending_topics").select("position").order("position", { ascending: false }).limit(1));
      unwrap(await ctx.supabase.from("trending_topics").insert({ ...row, position: (last[0]?.position ?? -10) + 10 }));
    }
    revalidateSite();
    return { ok: true, message: id ? "Na-save ang trending topic." : "Naidagdag ang trending topic." };
  } catch (e) {
    return toActionError(e);
  }
}

const trendingOpSchema = z.object({ id: z.uuid(), op: z.enum(["up", "down", "toggle", "delete"]) });

export async function trendingOp(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("taxonomy.manage");
    const { id, op } = trendingOpSchema.parse(Object.fromEntries(fd));
    if (op === "delete") {
      unwrap(await ctx.supabase.from("trending_topics").delete().eq("id", id));
    } else if (op === "toggle") {
      const t = must(await ctx.supabase.from("trending_topics").select("is_active").eq("id", id).single());
      must(await ctx.supabase.from("trending_topics").update({ is_active: !t.is_active }).eq("id", id).select("id").single());
    } else {
      const rows = must(await ctx.supabase.from("trending_topics").select("id, position").order("position").order("created_at"));
      for (const u of positionUpdates(rows, moveId(rows.map((r) => r.id), id, op))) {
        unwrap(await ctx.supabase.from("trending_topics").update({ position: u.position }).eq("id", u.id));
      }
    }
    revalidateSite();
    return { ok: true, message: op === "delete" ? "Inalis ang trending topic." : "Na-update." };
  } catch (e) {
    return toActionError(e);
  }
}
