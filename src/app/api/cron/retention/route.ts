import { createServiceClient } from "@/lib/supabase/server";
import { isAuthorizedCron } from "@/lib/security/cron";
import { logServerError } from "@/lib/log";

const PURGES = {
  result: "purge_old_analytics",
  applications: "purge_old_publisher_applications",
  tips: "purge_old_tips",
} as const;

/**
 * Daily data-retention job: deletes raw page-view events, rate-limit rows, reviewed publisher applications and
 * dismissed tips past retention. Each purge runs on its own, so one failing does not keep the others' data longer.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });
  const db = createServiceClient();
  const entries = await Promise.all(
    Object.entries(PURGES).map(async ([key, fn]) => {
      try {
        const { data, error } = await db.rpc(fn);
        if (error) throw error;
        return [key, data ?? null, true] as const;
      } catch (error) {
        logServerError(`cron_retention_failed:${fn}`, error);
        return [key, null, false] as const;
      }
    }),
  );
  const ok = entries.every(([, , done]) => done);
  const body = Object.fromEntries(entries.map(([key, data]) => [key, data]));
  return Response.json({ ok, ...body, failed: entries.filter(([, , done]) => !done).map(([key]) => key) }, { status: ok ? 200 : 500 });
}
