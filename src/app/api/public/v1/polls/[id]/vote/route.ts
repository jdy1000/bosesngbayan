import { cookies } from "next/headers";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { jsonError, jsonOk, readJson } from "@/lib/security/request";
import { networkHash, newVoterToken, voterHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { VOTER_COOKIE, getPollResults } from "@/lib/cms/polls";
import { getMessages } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import { logServerError } from "@/lib/log";

const bodySchema = (m: Messages["poll"]) =>
  z.object({
    optionIds: z.array(z.uuid()).min(1, m.pickAnswer).max(20),
    website: z.string().max(0).optional(), // honeypot: real browsers leave this empty
  });

const outcomes = (m: Messages["poll"]): Record<string, { status: number; message: string }> => ({
  ok: { status: 200, message: m.thanksVoted },
  already_voted: { status: 409, message: m.alreadyVoted },
  closed: { status: 409, message: m.pollClosed },
  invalid: { status: 422, message: m.invalidVote },
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = (await getMessages()).poll;
  if (!z.uuid().safeParse(id).success) return jsonError(m.notFound, 404);

  const parsed = await readJson(request, bodySchema(m));
  if (parsed.response) return parsed.response;
  if (parsed.data.website) return jsonError(m.invalidVote, 422);

  const net = networkHash(request.headers);
  if (!(await checkRateLimit("vote", net))) {
    return jsonError(m.rateLimited, 429);
  }

  const cookieStore = await cookies();
  let token = cookieStore.get(VOTER_COOKIE)?.value;
  if (!token || !/^[0-9a-f-]{36}$/.test(token)) {
    token = newVoterToken();
    cookieStore.set(VOTER_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2,
    });
  }
  const voter = voterHash(token);

  try {
    const { data, error } = await createServiceClient().rpc("cast_vote", {
      p_poll_id: id,
      p_option_ids: parsed.data.optionIds,
      p_voter_hash: voter,
      p_network_hash: net,
    });
    if (error) throw error;
    const status = (data as { status?: string } | null)?.status ?? "invalid";
    const messages = outcomes(m);
    const outcome = messages[status] ?? messages.invalid!;
    const results = await getPollResults(id, voter);
    if (status === "ok" || status === "already_voted") {
      return Response.json(
        { ok: status === "ok", status, message: outcome.message, results },
        { status: outcome.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return jsonError(outcome.message, outcome.status, { status });
  } catch (error) {
    logServerError("vote_failed", error);
    return jsonError(m.voteFailedRetry, 500);
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = (await getMessages()).poll;
  if (!z.uuid().safeParse(id).success) return jsonError(m.notFound, 404);
  const token = (await cookies()).get(VOTER_COOKIE)?.value;
  const voter = token && /^[0-9a-f-]{36}$/.test(token) ? voterHash(token) : null;
  try {
    return jsonOk({ results: await getPollResults(id, voter) });
  } catch (error) {
    logServerError("poll_results_failed", error);
    return jsonError(m.resultsFailed, 500);
  }
}
