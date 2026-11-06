import "server-only";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/session";
import { logServerError } from "@/lib/log";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Database exception names raised by our RPCs/triggers → safe messages for Studio (English-only). */
const DB_MESSAGES: Record<string, string> = {
  not_authorized: "You don't have permission for this action.",
  transition_not_allowed: "Your role can't make this status change.",
  invalid_transition: "Invalid status change.",
  rejection_reason_required: "A rejection reason is required.",
  category_required: "Choose a category first.",
  body_required: "The article body is empty.",
  schedule_must_be_future: "The schedule must be in the future.",
  workflow_fields_protected: "Status changes only through the editorial workflow.",
  placement_requires_publish_permission: "Changing homepage flags requires publish permission.",
  author_change_not_allowed: "You can't change the author.",
  poll_locked_after_votes: "This poll already has votes; its question and type can't change.",
  poll_options_locked_after_votes: "This poll already has votes; its options can't change. Close it and create a new poll.",
  cannot_change_own_role: "You can't change your own role.",
  cannot_deactivate_self: "You can't deactivate your own account.",
  owner_role_protected: "Only an Owner can change the Owner role.",
  at_least_one_owner_required: "There must be at least one active Owner.",
  owner_permissions_locked: "Owner permissions can't be changed.",
  roles_manage_owner_only: "Only the Owner can manage permissions.",
  use_set_user_active: "Use the Team page to deactivate an account.",
  no_draft: "There is no homepage draft.",
  only_approved_can_be_featured: "Only approved posts can be featured.",
  comments_closed: "Comments are closed for this item.",
};

interface PgLikeError {
  code?: string;
  message?: string;
}

export function toActionError(error: unknown): { ok: false; error: string } {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Invalid input." };
  const pg = error as PgLikeError | null;
  if (pg && typeof pg === "object" && typeof pg.message === "string") {
    const known = DB_MESSAGES[pg.message];
    if (known) return { ok: false, error: known };
    if (pg.code === "23505") return { ok: false, error: "That slug or record already exists. Use a different one." };
    if (pg.code === "23503") return { ok: false, error: "This is still used by other content, so it can't be deleted." };
    if (pg.code === "23514") return { ok: false, error: "The database rejected this value." };
    if (pg.code === "42501") return { ok: false, error: DB_MESSAGES.not_authorized };
  }
  logServerError("action_failed", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export function fieldErrors(error: z.ZodError): ActionResult<never> {
  const flat = z.flattenError(error);
  return {
    ok: false,
    error: error.issues[0]?.message ?? "Please check the fields.",
    fieldErrors: flat.fieldErrors as Record<string, string[]>,
  };
}

/** Throw a Supabase/PostgREST error so toActionError can classify it. */
export function unwrap<T>(result: { data: T; error: PgLikeError | null }): T {
  if (result.error) throw result.error;
  return result.data;
}
