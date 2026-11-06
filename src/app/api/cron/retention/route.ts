import { createServiceClient } from "@/lib/supabase/server";
import { isAuthorizedCron } from "@/lib/security/cron";
import { logServerError } from "@/lib/log";

/** Daily data-retention job: deletes raw page-view events and rate-limit rows past retention. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const { data, error } = await createServiceClient().rpc("purge_old_analytics");
    if (error) throw error;
    return Response.json({ ok: true, result: data ?? null });
  } catch (error) {
    logServerError("cron_retention_failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
