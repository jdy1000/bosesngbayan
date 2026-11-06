import "server-only";
import { cookies } from "next/headers";
import { createPublicClient, createServiceClient } from "@/lib/supabase/server";
import { voterHash } from "@/lib/security/hash";

export const VOTER_COOKIE = "bnb_voter";

export interface PollOption {
  id: string;
  label: string;
  position: number;
}

export interface PublicPoll {
  id: string;
  slug: string;
  question: string;
  description: string | null;
  kind: "single" | "multiple";
  max_choices: number;
  status: "published" | "closed";
  is_featured: boolean;
  opens_at: string | null;
  closes_at: string | null;
  results_visibility: "always" | "after_vote" | "after_close" | "hidden";
  methodology_note: string | null;
  published_at: string | null;
  closed_at: string | null;
  category: { id: string; slug: string; name: string } | null;
  options: PollOption[];
}

export interface PollResults {
  visible: boolean;
  has_voted: boolean;
  is_open: boolean;
  total_ballots?: number;
  options?: { option_id: string; votes: number }[];
}

const POLL_SELECT = `id, slug, question, description, kind, max_choices, status, is_featured, opens_at, closes_at,
  results_visibility, methodology_note, published_at, closed_at,
  category:categories(id, slug, name), options:poll_options(id, label, position)`;

function normalize(row: unknown): PublicPoll {
  const p = row as PublicPoll;
  return { ...p, options: [...p.options].sort((a, b) => a.position - b.position) };
}

export function isPollOpen(p: Pick<PublicPoll, "status" | "opens_at" | "closes_at">, now = new Date()): boolean {
  return (
    p.status === "published" &&
    (!p.opens_at || new Date(p.opens_at) <= now) &&
    (!p.closes_at || new Date(p.closes_at) > now)
  );
}

export async function listPublicPolls(filter: "active" | "past" | "all" = "all", limit = 24): Promise<PublicPoll[]> {
  const { data, error } = await createPublicClient()
    .from("polls")
    .select(POLL_SELECT)
    .in("status", ["published", "closed"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw error;
  const polls = (data ?? []).map(normalize);
  const now = new Date();
  const filtered =
    filter === "active" ? polls.filter((p) => isPollOpen(p, now)) : filter === "past" ? polls.filter((p) => !isPollOpen(p, now)) : polls;
  return filtered.slice(0, limit);
}

export async function getPublicPollBySlug(slug: string): Promise<PublicPoll | null> {
  const { data, error } = await createPublicClient()
    .from("polls")
    .select(POLL_SELECT)
    .eq("slug", slug)
    .in("status", ["published", "closed"])
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

export async function getPublicPollById(id: string): Promise<PublicPoll | null> {
  const { data, error } = await createPublicClient()
    .from("polls")
    .select(POLL_SELECT)
    .eq("id", id)
    .in("status", ["published", "closed"])
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

export async function getFeaturedPoll(): Promise<PublicPoll | null> {
  const { data, error } = await createPublicClient()
    .from("polls")
    .select(POLL_SELECT)
    .eq("is_featured", true)
    .in("status", ["published", "closed"])
    .maybeSingle();
  if (error) throw error;
  return data ? normalize(data) : null;
}

/** Current visitor's hashed voter id from the HttpOnly cookie (null if they never voted). */
export async function currentVoterHash(): Promise<string | null> {
  const token = (await cookies()).get(VOTER_COOKIE)?.value;
  return token && /^[0-9a-f-]{36}$/.test(token) ? voterHash(token) : null;
}

/**
 * Results respecting the poll's visibility rule, evaluated in the database
 * (get_poll_results). The service client is required because the voter hash is computed here.
 */
export async function getPollResults(pollId: string, voterHashValue: string | null): Promise<PollResults> {
  const { data, error } = await createServiceClient().rpc("get_poll_results", {
    p_poll_id: pollId,
    p_voter_hash: voterHashValue ?? undefined,
  });
  if (error) throw error;
  return (data as PollResults | null) ?? { visible: false, has_voted: false, is_open: false };
}
