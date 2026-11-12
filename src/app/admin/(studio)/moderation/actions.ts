"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { must } from "@/lib/studio/db";
import { optionalText } from "@/lib/studio/form";
import type { FormActionResult } from "@/components/studio/action-form";
import { ACTION_LABELS, MODERATION_ACTIONS, REPORT_STATUSES } from "./labels";

const moderateSchema = z.object({
  target_type: z.enum(["community_post", "comment"]),
  target_id: z.uuid(),
  action: z.enum(MODERATION_ACTIONS),
  note: optionalText(2000),
});

export async function moderate(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("moderation.manage");
    const input = moderateSchema.parse(Object.fromEntries(fd));
    if (input.target_type === "comment" && (input.action === "feature" || input.action === "unfeature")) {
      return { ok: false, error: "Only posts can be featured." };
    }
    // moderate_content re-checks moderation.manage, validates the action and writes the activity log.
    unwrap(
      await ctx.supabase.rpc("moderate_content", {
        p_target_type: input.target_type,
        p_target_id: input.target_id,
        p_action: input.action,
        p_note: input.note,
      }),
    );

    revalidatePath("/usap-bayan", "layout");
    if (input.target_type === "community_post") {
      revalidatePath("/");
    } else {
      const comment = must(await ctx.supabase.from("comments").select("article:articles(slug)").eq("id", input.target_id).single());
      if (comment.article?.slug) revalidatePath(`/balita/${comment.article.slug}`);
    }
    return { ok: true, message: `Done: ${ACTION_LABELS[input.action]}.` };
  } catch (e) {
    return toActionError(e);
  }
}

const reportSchema = z.object({
  report_id: z.uuid(),
  status: z.enum(REPORT_STATUSES),
  note: optionalText(2000),
});

/** Sets a report to open, reviewing, resolved or dismissed and saves the resolution note. */
export async function resolveReport(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("moderation.manage");
    const input = reportSchema.parse(Object.fromEntries(fd));
    // resolve_report re-checks moderation.manage, stamps resolved_by/resolved_at only on a closing status and writes the activity log.
    unwrap(await ctx.supabase.rpc("resolve_report", { p_report_id: input.report_id, p_status: input.status, p_note: input.note }));
    revalidatePath("/admin/moderation", "layout");
    return { ok: true, message: "Report updated." };
  } catch (e) {
    return toActionError(e);
  }
}
