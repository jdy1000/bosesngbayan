import { createServiceClient } from "@/lib/supabase/server";
import { isAuthorizedCron } from "@/lib/security/cron";
import { logServerError } from "@/lib/log";

/** Daily data-retention job: deletes raw page-view events, rate-limit rows and reviewed publisher applications past retention. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const db = createServiceClient();
    const { data, error } = await db.rpc("purge_old_analytics");
    if (error) throw error;
    const applications = await db.rpc("purge_old_publisher_applications");
    if (applications.error) throw applications.error;
    return Response.json({ ok: true, result: data ?? null, applications: applications.data ?? null });
  } catch (error) {
    logServerError("cron_retention_failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
