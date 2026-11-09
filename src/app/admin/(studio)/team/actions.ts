"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthorizationError, getStaffContext, requirePermission } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { isPermission, ROLES } from "@/lib/auth/permissions";
import { logServerError } from "@/lib/log";
import { authAdmin, inviteStaff } from "@/lib/studio/invite";
import { optionalText, requiredText } from "@/lib/studio/form";
import type { FormActionResult } from "@/components/studio/action-form";
import { must } from "@/lib/studio/db";

const roleSchema = z.enum(ROLES, { message: "Choose a valid role." });
const userId = z.uuid();
const BAN_FOREVER = "876000h"; // ~100 years; Supabase Auth has no permanent-ban flag

export async function inviteMember(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("users.manage");
    const input = z
      .object({
        email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")),
        display_name: requiredText(1, 120, "Name"),
        role: roleSchema,
      })
      .parse(Object.fromEntries(fd));
    const result = await inviteStaff(ctx, { email: input.email, displayName: input.display_name, role: input.role });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/admin/team");
    return { ok: true, message: `Invitation sent to ${input.email}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function changeRole(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("users.manage");
    const input = z.object({ id: userId, role: roleSchema }).parse(Object.fromEntries(fd));
    unwrap(await ctx.supabase.rpc("set_user_role", { p_user_id: input.id, p_role: input.role }));
    revalidatePath("/admin/team");
    return { ok: true, message: "Role changed. It takes effect on the user's next request." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setMemberActive(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("users.manage");
    const input = z.object({ id: userId, active: z.enum(["true", "false"]).transform((v) => v === "true") }).parse(Object.fromEntries(fd));
    // Database first: an inactive profile loses every permission immediately, even if the ban below fails.
    unwrap(await ctx.supabase.rpc("set_user_active", { p_user_id: input.id, p_active: input.active }));
    revalidatePath("/admin/team");

    const admin = authAdmin();
    const ban = admin ? await admin.updateUserById(input.id, { ban_duration: input.active ? "none" : BAN_FOREVER }) : null;
    if (!ban || ban.error) {
      if (ban?.error) logServerError("auth_ban_update_failed", ban.error);
      return {
        ok: false,
        error: input.active
          ? "Reactivated in Studio, but the Supabase Auth ban could not be lifted, so the user still cannot sign in. Try again."
          : "Deactivated in Studio (no more access), but the Supabase Auth ban failed. Try again to block sign-in.",
      };
    }
    return {
      ok: true,
      message: input.active
        ? "Reactivated. The user can sign in again."
        : "Deactivated and banned from signing in. The current session ends when its access token expires; it no longer has any Studio permissions.",
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateMemberProfile(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await getStaffContext();
    if (!ctx) throw new AuthorizationError("You need to sign in.");
    const input = z
      .object({ id: userId, display_name: requiredText(1, 120, "Name"), title: optionalText(120), bio: optionalText(2000) })
      .parse(Object.fromEntries(fd));
    if (input.id !== ctx.userId && !ctx.permissions.has("users.manage")) throw new AuthorizationError();
    const { id, ...fields } = input;
    const updated = must(await ctx.supabase.from("profiles").update(fields).eq("id", id).select("id"));
    if (updated.length === 0) throw new AuthorizationError();
    unwrap(await ctx.supabase.rpc("write_audit", { p_action: "update_profile", p_entity_type: "profiles", p_entity_id: id, p_details: { fields: Object.keys(fields) } }));
    revalidatePath("/admin/team");
    revalidatePath(`/admin/team/${id}`);
    return { ok: true, message: "Profile saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveRolePermissions(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("roles.manage");
    const role = roleSchema.exclude(["owner"]).parse(fd.get("role"));
    const desired = new Set<string>(fd.getAll("perm").map(String).filter(isPermission).filter((p) => p !== "roles.manage"));
    const current = new Set(must(await ctx.supabase.from("role_permissions").select("permission").eq("role", role)).map((r) => r.permission));
    const all = must(await ctx.supabase.from("permissions").select("key")).map((p) => p.key).filter((k) => k !== "roles.manage");
    let changed = 0;
    for (const key of all) {
      const want = desired.has(key);
      if (want === current.has(key)) continue;
      unwrap(await ctx.supabase.rpc("set_role_permission", { p_role: role, p_permission: key, p_granted: want }));
      changed++;
    }
    revalidatePath("/admin/team");
    return { ok: true, message: changed === 0 ? "Nothing changed." : `Updated ${changed} permission(s) for ${role}.` };
  } catch (e) {
    return toActionError(e);
  }
}
