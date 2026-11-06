import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthorizationError, requirePermission } from "@/lib/auth/session";
import { csvResponse, toCsv } from "@/lib/studio/csv";
import { logServerError } from "@/lib/log";

const BATCH = 1000; // PostgREST max rows per request

/** CSV of anonymous ballots (ballot id, time, option). export_poll_votes re-checks polls.view_results. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePermission("polls.view_results");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Hindi wastong poll." }, { status: 400 });

    const { data: poll, error: pollError } = await ctx.supabase.from("polls").select("slug").eq("id", id).maybeSingle();
    if (pollError) throw pollError;
    if (!poll) return NextResponse.json({ error: "Hindi nahanap ang poll." }, { status: 404 });

    const rows: string[][] = [];
    for (let from = 0; ; from += BATCH) {
      const { data, error } = await ctx.supabase
        .rpc("export_poll_votes", { p_poll_id: id })
        .order("voted_at")
        .order("ballot_id")
        .order("option_label")
        .range(from, from + BATCH - 1);
      if (error) throw error;
      for (const r of data ?? []) rows.push([r.ballot_id, r.voted_at, r.option_label]);
      if (!data || data.length < BATCH) break;
    }

    const audit = await ctx.supabase.rpc("write_audit", {
      p_action: "poll_votes_export",
      p_entity_type: "polls",
      p_entity_id: id,
      p_details: { rows: rows.length },
    });
    if (audit.error) throw audit.error; // exports of vote data must be auditable
    const date = new Date().toISOString().slice(0, 10);
    return csvResponse(toCsv(["ballot_id", "voted_at_utc", "option_label"], rows), `poll-${poll.slug}-${date}.csv`);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    logServerError("poll_export_failed", e);
    return NextResponse.json({ error: "Hindi ma-export ang resulta." }, { status: 500 });
  }
}
