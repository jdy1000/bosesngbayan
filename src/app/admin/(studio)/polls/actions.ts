"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, type StaffContext } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { must } from "@/lib/studio/db";
import { manilaLocalToIso, slugify } from "@/lib/format";
import { optionalText, optionalUuid, requiredText, slugField } from "@/lib/studio/form";
import { moveId, positionUpdates } from "@/lib/studio/reorder";
import type { FormActionResult } from "@/components/studio/action-form";

const localDate = z.preprocess((v) => {
  if (typeof v !== "string" || v === "") return null;
  return manilaLocalToIso(v) ?? "invalid";
}, z.iso.datetime({ message: "Invalid date." }).nullable());

const pollSchema = z
  .object({
    question: requiredText(5, 300, "Question"),
    slug: slugField,
    description: optionalText(1000),
    kind: z.enum(["single", "multiple"]).optional(),
    max_choices: z.coerce.number().int().min(1).max(20).optional(),
    opens_at: localDate,
    closes_at: localDate,
    results_visibility: z.enum(["always", "after_vote", "after_close", "hidden"]),
    voting_policy: z.enum(["one_per_browser", "one_per_browser_and_network"]).optional(),
    methodology_note: optionalText(2000),
    category_id: optionalUuid,
  })
  .refine((p) => !p.opens_at || !p.closes_at || p.closes_at > p.opens_at, { message: "The closing time must be after the opening time." });

function revalidatePoll(slug?: string | null) {
  revalidatePath("/");
  revalidatePath("/botohan");
  if (slug) revalidatePath(`/botohan/${slug}`);
}

async function hasVotes(ctx: StaffContext, pollId: string): Promise<boolean> {
  return must(await ctx.supabase.rpc("poll_has_votes", { p_poll_id: pollId })) === true;
}

function parseOptionLines(raw: FormDataEntryValue | null): string[] {
  const lines = String(raw ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return z
    .array(z.string().max(200, "Up to 200 characters per option."))
    .min(2, "Enter at least 2 options (one per line).")
    .max(20, "Up to 20 options only.")
    .parse(lines);
}

export async function createPoll(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("polls.manage");
    const input = pollSchema.parse(Object.fromEntries(fd));
    const options = parseOptionLines(fd.get("options"));
    const kind = input.kind ?? "single";
    const maxChoices = kind === "single" ? 1 : Math.min(input.max_choices ?? 2, options.length);
    const poll = must(
      await ctx.supabase
        .from("polls")
        .insert({
          question: input.question,
          slug: input.slug || slugify(input.question, 120),
          description: input.description,
          kind,
          max_choices: maxChoices,
          opens_at: input.opens_at,
          closes_at: input.closes_at,
          results_visibility: input.results_visibility,
          voting_policy: input.voting_policy ?? "one_per_browser",
          methodology_note: input.methodology_note,
          category_id: input.category_id,
          created_by: ctx.userId,
          updated_by: ctx.userId,
        })
        .select("id")
        .single(),
    );
    const { error } = await ctx.supabase.from("poll_options").insert(options.map((label, i) => ({ poll_id: poll.id, label, position: i * 10 })));
    if (error) {
      // Do not leave an option-less draft behind.
      await ctx.supabase.from("polls").delete().eq("id", poll.id);
      throw error;
    }
    return { ok: true, message: "Poll created as a draft.", redirectTo: `/admin/polls/${poll.id}` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updatePoll(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("polls.manage");
    const id = z.uuid().parse(fd.get("id"));
    const input = pollSchema.parse(Object.fromEntries(fd));
    const current = must(await ctx.supabase.from("polls").select("slug").eq("id", id).single());
    const locked = await hasVotes(ctx, id);
    const kind = input.kind ?? "single";
    const patch = {
      slug: input.slug || current.slug,
      description: input.description,
      opens_at: input.opens_at,
      closes_at: input.closes_at,
      results_visibility: input.results_visibility,
      methodology_note: input.methodology_note,
      category_id: input.category_id,
      updated_by: ctx.userId,
      // Meaning-bearing fields are frozen once votes exist (also enforced by polls_guard).
      ...(locked
        ? {}
        : {
            question: input.question,
            kind,
            max_choices: kind === "single" ? 1 : (input.max_choices ?? 2),
            voting_policy: input.voting_policy ?? "one_per_browser",
          }),
    };
    must(await ctx.supabase.from("polls").update(patch).eq("id", id).select("id").single());
    revalidatePoll(current.slug);
    if (patch.slug !== current.slug) revalidatePoll(patch.slug);
    return { ok: true, message: "Poll saved." };
  } catch (e) {
    return toActionError(e);
  }
}

const lifecycleSchema = z.object({
  id: z.uuid(),
  op: z.enum(["publish", "unpublish", "close", "archive", "feature", "unfeature", "delete"]),
});
type PollStatus = "draft" | "published" | "closed" | "archived";

export async function pollLifecycle(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("polls.manage");
    const { id, op } = lifecycleSchema.parse(Object.fromEntries(fd));
    const poll = must(
      await ctx.supabase.from("polls").select("id, slug, status, kind, max_choices, options:poll_options(id)").eq("id", id).single(),
    );
    const fail = (error: string): FormActionResult => ({ ok: false, error });
    const update = async (patch: { status?: PollStatus; is_featured?: boolean }) => {
      must(await ctx.supabase.from("polls").update({ ...patch, updated_by: ctx.userId }).eq("id", id).select("id").single());
    };
    let message: string;

    switch (op) {
      case "publish":
        if (poll.status !== "draft") return fail("Only drafts can be published.");
        if (poll.options.length < 2) return fail("A poll needs at least 2 options before it can be published.");
        if (poll.kind === "multiple" && poll.max_choices > poll.options.length) return fail("Max choices is higher than the number of options.");
        await update({ status: "published" });
        message = "Poll published.";
        break;
      case "unpublish":
        if (poll.status !== "published") return fail("This poll is not published.");
        // Product rule: a poll with ballots is never silently pulled back to draft; close or archive it.
        if (await hasVotes(ctx, id)) return fail("This poll already has votes; close or archive it instead of returning it to draft.");
        await update({ status: "draft", is_featured: false });
        message = "Poll returned to draft.";
        break;
      case "close":
        if (poll.status !== "published") return fail("Only published polls can be closed.");
        await update({ status: "closed" });
        message = "Poll closed.";
        break;
      case "archive":
        if (poll.status === "archived") return fail("This poll is already archived.");
        await update({ status: "archived", is_featured: false });
        message = "Poll archived.";
        break;
      case "feature":
        if (poll.status !== "published" && poll.status !== "closed") return fail("Only published or closed polls can be featured.");
        // Only one featured poll (unique index polls_one_featured): clear the current one first.
        unwrap(await ctx.supabase.from("polls").update({ is_featured: false, updated_by: ctx.userId }).eq("is_featured", true).neq("id", id));
        await update({ is_featured: true });
        message = "This is now the featured poll.";
        break;
      case "unfeature":
        await update({ is_featured: false });
        message = "Removed from featured.";
        break;
      case "delete":
        if (poll.status !== "draft" || (await hasVotes(ctx, id))) return fail("Only drafts with no votes can be deleted. Archive it instead.");
        unwrap(await ctx.supabase.from("polls").delete().eq("id", id));
        revalidatePoll(poll.slug);
        return { ok: true, message: "Poll deleted.", redirectTo: "/admin/polls" };
    }
    revalidatePoll(poll.slug);
    return { ok: true, message };
  } catch (e) {
    return toActionError(e);
  }
}

const optionSchema = z.object({ poll_id: z.uuid(), label: requiredText(1, 200, "Option") });

export async function addOption(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("polls.manage");
    const { poll_id, label } = optionSchema.parse(Object.fromEntries(fd));
    const existing = must(await ctx.supabase.from("poll_options").select("position").eq("poll_id", poll_id));
    if (existing.length >= 20) return { ok: false, error: "Up to 20 options only." };
    const position = existing.reduce((m, o) => Math.max(m, o.position), -10) + 10;
    unwrap(await ctx.supabase.from("poll_options").insert({ poll_id, label, position }));
    const poll = must(await ctx.supabase.from("polls").select("slug").eq("id", poll_id).single());
    revalidatePoll(poll.slug);
    return { ok: true, message: "Option added." };
  } catch (e) {
    return toActionError(e);
  }
}

const optionOpSchema = z.object({
  poll_id: z.uuid(),
  option_id: z.uuid(),
  op: z.enum(["save", "remove", "up", "down"]),
  label: z.string().optional(),
});

export async function optionAction(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("polls.manage");
    const { poll_id, option_id, op, label } = optionOpSchema.parse(Object.fromEntries(fd));
    const poll = must(await ctx.supabase.from("polls").select("slug, status").eq("id", poll_id).single());
    if (op === "save") {
      const clean = requiredText(1, 200, "Option").parse(label);
      must(await ctx.supabase.from("poll_options").update({ label: clean }).eq("id", option_id).eq("poll_id", poll_id).select("id").single());
    } else if (op === "remove") {
      const count = must(await ctx.supabase.from("poll_options").select("id").eq("poll_id", poll_id)).length;
      if (poll.status !== "draft" && count <= 2) return { ok: false, error: "A published poll needs at least 2 options." };
      unwrap(await ctx.supabase.from("poll_options").delete().eq("id", option_id).eq("poll_id", poll_id));
    } else {
      // Reordering stays allowed after votes (poll_options_guard permits position-only updates).
      const rows = must(await ctx.supabase.from("poll_options").select("id, position").eq("poll_id", poll_id).order("position").order("created_at"));
      for (const u of positionUpdates(rows, moveId(rows.map((r) => r.id), option_id, op))) {
        unwrap(await ctx.supabase.from("poll_options").update({ position: u.position }).eq("id", u.id).eq("poll_id", poll_id));
      }
    }
    revalidatePoll(poll.slug);
    return { ok: true, message: op === "remove" ? "Option removed." : "Options updated." };
  } catch (e) {
    return toActionError(e);
  }
}
