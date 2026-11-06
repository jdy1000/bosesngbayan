import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, readJson } from "@/lib/security/request";
import { networkHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSiteSettings } from "@/lib/cms/site";
import { logServerError } from "@/lib/log";
import { getMessages } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";

const bodySchema = (m: Messages["community"]["api"]) => z.object({
  kind: z.enum(["perspective", "question"]),
  title: z.string().trim().min(5, m.titleTooShort).max(200),
  body: z.string().trim().min(20, m.bodyTooShort).max(5000),
  authorName: z.string().trim().min(2, m.nameRequired).max(80),
  authorEmail: z.union([z.literal(""), z.string().trim().toLowerCase().max(254).pipe(z.email(m.invalidEmail))]).default(""),
  authorLocation: z.string().trim().max(120).default(""),
  categoryId: z.uuid().nullable().default(null),
  agree: z.literal(true, { error: m.agreeRequired }),
  website: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  const m = (await getMessages()).community.api;
  const parsed = await readJson(request, bodySchema(m));
  if (parsed.response) return parsed.response;
  if (parsed.data.website) return jsonOk({ status: "pending" });

  const settings = await getSiteSettings();
  if (!settings.community.submissions_enabled) return jsonError(m.closed, 503);

  const net = networkHash(request.headers);
  if (!(await checkRateLimit("submission", net))) {
    return jsonError(m.rateLimited, 429);
  }

  try {
    const d = parsed.data;
    const { data, error } = await createServiceClient().rpc("submit_community_post", {
      p_kind: d.kind,
      p_title: d.title,
      p_body: d.body,
      p_author_name: d.authorName,
      p_author_email: d.authorEmail,
      p_author_location: d.authorLocation,
      p_category_id: d.categoryId ?? null,
      p_network_hash: net,
    });
    if (error) throw error;
    const status = (data as { status?: string } | null)?.status ?? "pending";
    return jsonOk(
      {
        status,
        message: status === "approved" ? m.published : m.pending,
      },
      { status: 201 },
    );
  } catch (error) {
    logServerError("community_submit_failed", error);
    return jsonError(m.failed, 500);
  }
}
