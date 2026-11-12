import "server-only";
import type { StaffContext } from "@/lib/auth/session";
import type { AppRole } from "@/lib/auth/permissions";
import { toActionError } from "@/lib/actions";
import { adminUrl } from "@/lib/env";
import { logServerError } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/server";

/** Service client for Auth admin calls only. Callers must have passed requirePermission("users.manage") first. */
export function authAdmin() {
  try {
    return createServiceClient().auth.admin;
  } catch (e) {
    logServerError("service_client_unavailable", e);
    return null;
  }
}

export type InviteResult = { ok: true; userId: string } | { ok: false; error: string; emailExists?: boolean };

/**
 * Invite a staff member: Supabase Auth sends the invitation email, then the role is assigned as the
 * inviter (set_user_role re-checks users.manage and the owner guard). Rolls the account back if the
 * role cannot be set. The caller must already hold users.manage and have validated the input.
 */
export async function inviteStaff(ctx: StaffContext, input: { email: string; displayName: string; role: AppRole }): Promise<InviteResult> {
  if (input.role === "owner" && ctx.role !== "owner") return toActionError({ message: "owner_role_protected" });

  const admin = authAdmin();
  if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server, so invitations cannot be sent." };
  const { data, error } = await admin.inviteUserByEmail(input.email, {
    redirectTo: adminUrl("/admin/auth/callback?next=/admin/auth/update-password"),
    data: { display_name: input.displayName },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.status === 422) return { ok: false, error: "This email already has an account.", emailExists: true };
    logServerError("invite_failed", error);
    return { ok: false, error: "The invitation could not be sent. Check the Supabase Auth SMTP configuration." };
  }

  const { error: roleError } = await ctx.supabase.rpc("set_user_role", { p_user_id: data.user.id, p_role: input.role });
  if (roleError) {
    const { error: rollbackError } = await admin.deleteUser(data.user.id);
    if (rollbackError) logServerError("invite_rollback_failed", rollbackError);
    const reason = toActionError(roleError).error;
    return {
      ok: false,
      error: rollbackError
        ? `The role could not be set (${reason}) and the invited account could not be removed. Delete it in the Supabase Auth dashboard.`
        : `The role could not be set: ${reason} The invitation was revoked.`,
    };
  }
  return { ok: true, userId: data.user.id };
}
