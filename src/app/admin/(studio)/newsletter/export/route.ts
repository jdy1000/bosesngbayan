import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requirePermission } from "@/lib/auth/session";
import { csvResponse, toCsv } from "@/lib/studio/csv";
import { logServerError } from "@/lib/log";

const BATCH = 1000; // PostgREST max rows per request
const STATUSES = ["subscribed", "unsubscribed", "suppressed"] as const;

/** Subscriber CSV. Export is a newsletter.manage capability; RLS reads require newsletter.view. Unsubscribe tokens are never exported. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission("newsletter.manage", "newsletter.view");
    const status = STATUSES.find((s) => s === request.nextUrl.searchParams.get("status"));

    const rows: (string | boolean | null)[][] = [];
    for (let from = 0; ; from += BATCH) {
      let query = ctx.supabase
        .from("newsletter_subscribers")
        .select("email, status, consent_given, consent_text, consent_at, source, subscribed_at, unsubscribed_at, suppressed_at, suppression_reason")
        .order("subscribed_at")
        .order("id")
        .range(from, from + BATCH - 1);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      for (const r of data ?? []) {
        rows.push([r.email, r.status, r.consent_given, r.consent_text, r.consent_at, r.source, r.subscribed_at, r.unsubscribed_at, r.suppressed_at, r.suppression_reason]);
      }
      if (!data || data.length < BATCH) break;
    }

    const audit = await ctx.supabase.rpc("write_audit", {
      p_action: "newsletter_export",
      p_entity_type: "newsletter_subscribers",
      p_entity_id: null,
      p_details: { rows: rows.length, status: status ?? "all" },
    });
    if (audit.error) throw audit.error; // personal-data exports must be auditable

    const header = ["email", "status", "consent_given", "consent_text", "consent_at_utc", "source", "subscribed_at_utc", "unsubscribed_at_utc", "suppressed_at_utc", "suppression_reason"];
    const date = new Date().toISOString().slice(0, 10);
    return csvResponse(toCsv(header, rows), `newsletter-${status ?? "lahat"}-${date}.csv`);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    logServerError("newsletter_export_failed", e);
    return NextResponse.json({ error: "Hindi ma-export ang mga subscriber." }, { status: 500 });
  }
}
