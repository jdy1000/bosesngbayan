import "server-only";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log";

/**
 * Called where a public route would 404: honours an active CMS redirect for this path first.
 * Destinations are constrained in the database to same-site paths or https URLs (no open redirect
 * via user input — only staff with seo.manage can create them).
 */
export async function redirectOrNotFound(path: string): Promise<never> {
  const { data, error } = await createPublicClient()
    .from("redirects")
    .select("destination, status_code")
    .eq("source_path", path)
    .eq("is_active", true)
    .maybeSingle();
  if (error) logServerError("redirect_lookup_failed", error);
  if (data) {
    if (data.status_code === 301 || data.status_code === 308) permanentRedirect(data.destination);
    redirect(data.destination);
  }
  notFound();
}
