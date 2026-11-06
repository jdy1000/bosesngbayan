import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, readJson } from "@/lib/security/request";
import { networkHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logServerError } from "@/lib/log";
import { REPORT_REASONS } from "@/lib/report-reasons";


const bodySchema = z
  .object({
    postId: z.uuid().nullable().default(null),
    commentId: z.uuid().nullable().default(null),
    reason: z.enum(REPORT_REASONS, { error: "Pumili ng dahilan." }),
    details: z.string().trim().max(1000).default(""),
  })
  .refine((d) => (d.postId === null) !== (d.commentId === null), { message: "Hindi wastong target." });

export async function POST(request: Request) {
  const parsed = await readJson(request, bodySchema);
  if (parsed.response) return parsed.response;

  const net = networkHash(request.headers);
  if (!(await checkRateLimit("report", net))) return jsonError("Masyadong maraming ulat. Subukan muli mamaya.", 429);

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
      if (error.message === "target_not_found") return jsonError("Hindi nahanap ang nilalaman.", 404);
      throw error;
    }
    return jsonOk({ message: "Salamat. Susuriin ng aming mga moderator ang iyong ulat." }, { status: 201 });
  } catch (error) {
    logServerError("report_submit_failed", error);
    return jsonError("Hindi naisumite ang ulat.", 500);
  }
}
