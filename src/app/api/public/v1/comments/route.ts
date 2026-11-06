import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, readJson } from "@/lib/security/request";
import { networkHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSiteSettings } from "@/lib/cms/site";
import { getMessages } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import { logServerError } from "@/lib/log";

const bodySchema = (m: Messages["article"]["comments"]) =>
  z
    .object({
      articleId: z.uuid().nullable().default(null),
      postId: z.uuid().nullable().default(null),
      parentId: z.uuid().nullable().default(null),
      authorName: z.string().trim().min(2, m.nameRequired).max(80),
      authorEmail: z.union([z.literal(""), z.string().trim().toLowerCase().max(254).pipe(z.email(m.invalidEmail))]).default(""),
      body: z.string().trim().min(2, m.tooShort).max(2000),
      website: z.string().max(0).optional(),
    })
    .refine((d) => (d.articleId === null) !== (d.postId === null), { message: m.invalidTarget });

export async function POST(request: Request) {
  const m = (await getMessages()).article.comments;
  const parsed = await readJson(request, bodySchema(m));
  if (parsed.response) return parsed.response;
  if (parsed.data.website) return jsonOk({ status: "pending" });

  const settings = await getSiteSettings();
  if (!settings.publication.comments_enabled) return jsonError(m.disabled, 403);

  const net = networkHash(request.headers);
  if (!(await checkRateLimit("comment", net))) return jsonError(m.rateLimited, 429);

  try {
    const d = parsed.data;
    const { data, error } = await createServiceClient().rpc("submit_comment", {
      p_article_id: d.articleId ?? null,
      p_post_id: d.postId ?? null,
      p_parent_id: d.parentId ?? null,
      p_author_name: d.authorName,
      p_author_email: d.authorEmail,
      p_body: d.body,
      p_network_hash: net,
    });
    if (error) {
      if (error.message === "comments_closed" || error.message === "parent_not_found") {
        return jsonError(m.notAccepting, 409);
      }
      throw error;
    }
    const status = (data as { status?: string } | null)?.status ?? "pending";
    return jsonOk(
      {
        status,
        message: status === "approved" ? m.published : m.pending,
      },
      { status: 201 },
    );
  } catch (error) {
    logServerError("comment_submit_failed", error);
    return jsonError(m.submitFailed, 500);
  }
}
