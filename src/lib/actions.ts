import "server-only";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/session";
import { logServerError } from "@/lib/log";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Database exception names raised by our RPCs/triggers → safe Filipino messages. */
const DB_MESSAGES: Record<string, string> = {
  not_authorized: "Wala kang pahintulot para sa aksyong ito.",
  transition_not_allowed: "Hindi pinapayagan ang pagbabagong ito ng status para sa iyong role.",
  invalid_transition: "Hindi wastong pagbabago ng status.",
  rejection_reason_required: "Kailangan ng dahilan sa pag-reject.",
  category_required: "Pumili muna ng kategorya.",
  body_required: "Walang laman ang artikulo.",
  schedule_must_be_future: "Ang iskedyul ay dapat nasa hinaharap.",
  workflow_fields_protected: "Ang status ay binabago lamang sa pamamagitan ng editorial workflow.",
  placement_requires_publish_permission: "Kailangan ng pahintulot sa pag-publish para baguhin ang homepage flags.",
  author_change_not_allowed: "Hindi mo mababago ang may-akda.",
  poll_locked_after_votes: "May mga boto na ang poll na ito; hindi na mababago ang tanong o uri nito.",
  poll_options_locked_after_votes: "May mga boto na; hindi na mababago ang mga pagpipilian. Isara ito at gumawa ng bagong poll.",
  cannot_change_own_role: "Hindi mo mababago ang sarili mong role.",
  cannot_deactivate_self: "Hindi mo madi-deactivate ang sarili mong account.",
  owner_role_protected: "Ang Owner lamang ang makakapagbago ng Owner role.",
  at_least_one_owner_required: "Kailangang may kahit isang aktibong Owner.",
  owner_permissions_locked: "Hindi nababago ang mga pahintulot ng Owner.",
  roles_manage_owner_only: "Ang pamamahala ng mga pahintulot ay para lamang sa Owner.",
  use_set_user_active: "Gamitin ang Team page para i-deactivate ang account.",
  no_draft: "Walang draft na homepage.",
  only_approved_can_be_featured: "Ang mga naaprubahang post lamang ang maaaring i-feature.",
  comments_closed: "Sarado na ang komento para dito.",
};

interface PgLikeError {
  code?: string;
  message?: string;
}

export function toActionError(error: unknown): { ok: false; error: string } {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Hindi wastong input." };
  const pg = error as PgLikeError | null;
  if (pg && typeof pg === "object" && typeof pg.message === "string") {
    const known = DB_MESSAGES[pg.message];
    if (known) return { ok: false, error: known };
    if (pg.code === "23505") return { ok: false, error: "May kaparehong slug o tala na. Gumamit ng iba." };
    if (pg.code === "23503") return { ok: false, error: "Ginagamit pa ito ng ibang nilalaman kaya hindi maaaring tanggalin." };
    if (pg.code === "23514") return { ok: false, error: "Hindi pumasa sa validation ng database." };
    if (pg.code === "42501") return { ok: false, error: DB_MESSAGES.not_authorized };
  }
  logServerError("action_failed", error);
  return { ok: false, error: "May nangyaring error. Subukang muli." };
}

export function fieldErrors(error: z.ZodError): ActionResult<never> {
  const flat = z.flattenError(error);
  return {
    ok: false,
    error: error.issues[0]?.message ?? "Pakisuri ang mga field.",
    fieldErrors: flat.fieldErrors as Record<string, string[]>,
  };
}

/** Throw a Supabase/PostgREST error so toActionError can classify it. */
export function unwrap<T>(result: { data: T; error: PgLikeError | null }): T {
  if (result.error) throw result.error;
  return result.data;
}
