import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, readJson } from "@/lib/security/request";
import { networkHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logServerError } from "@/lib/log";
import { REPORT_REASONS } from "@/lib/report-reasons";
import { getMessages } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";

const bodySchema = (m: Messages["article"]["report"]) =>
  z
    .object({
      postId: z.uuid().nullable().default(null),
      commentId: z.uuid().nullable().default(null),
      reason: z.enum(REPORT_REASONS, { error: m.pickReason }),
      details: z.string().trim().max(1000).default(""),
    })
    .refine((d) => (d.postId === null) !== (d.commentId === null), { message: m.invalidTarget });

export async function POST(request: Request) {
  const m = (await getMessages()).article.report;
  const parsed = await readJson(request, bodySchema(m));
  if (parsed.response) return parsed.response;

  const net = networkHash(request.headers);
  if (!(await checkRateLimit("report", net))) return jsonError(m.rateLimited, 429);

  try {
    const d = parsed.data;
    const { error } = await createServiceClient().rpc("submit_report", {
      p_post_id: d.postId ?? null,
      p_comment_id: d.commentId ?? null,
      p_reason: d.reason,
      p_details: d.details,
      p_network_hash: net,
    });
    if (error) {
      if (error.message === "target_not_found") return jsonError(m.notFound, 404);
      throw error;
    }
    return jsonOk({ message: m.received }, { status: 201 });
  } catch (error) {
    logServerError("report_submit_failed", error);
    return jsonError(m.submitFailed, 500);
  }
}
