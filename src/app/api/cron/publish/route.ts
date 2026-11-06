import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { isAuthorizedCron } from "@/lib/security/cron";
import { logServerError } from "@/lib/log";

/**
 * Flips due `scheduled` articles to `published` (publish_due_articles, service-role only).
 * Public visibility does not depend on this job: article_is_public() already treats a scheduled
 * article as public once published_at has passed, so a late run never delays publication.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const { data, error } = await createServiceClient().rpc("publish_due_articles");
    if (error) throw error;
    if (Number(data) > 0) {
      revalidatePath("/", "layout");
    }
    return Response.json({ ok: true, published: Number(data ?? 0) });
  } catch (error) {
    logServerError("cron_publish_failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
