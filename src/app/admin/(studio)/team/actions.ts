"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthorizationError, getStaffContext, requirePermission } from "@/lib/auth/session";
import { toActionError, unwrap } from "@/lib/actions";
import { isPermission, ROLES } from "@/lib/auth/permissions";
import { siteUrl } from "@/lib/env";
import { logServerError } from "@/lib/log";
import { createServiceClient } from "@/lib/supabase/server";
import { optionalText, requiredText } from "@/lib/studio/form";
import type { FormActionResult } from "@/components/studio/action-form";
import { must } from "@/lib/studio/db";

const roleSchema = z.enum(ROLES, { message: "Pumili ng wastong role." });
const userId = z.uuid();
const BAN_FOREVER = "876000h"; // ~100 years; Supabase Auth has no permanent-ban flag

/** Service client for Auth admin calls only. Callers must have passed requirePermission first. */
function authAdmin() {
  try {
    return createServiceClient().auth.admin;
  } catch (e) {
    logServerError("service_client_unavailable", e);
    return null;
  }
}

export async function inviteMember(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await requirePermission("users.manage");
    const input = z
      .object({
        email: z.string().trim().toLowerCase().pipe(z.email("Ilagay ang wastong email.")),
        display_name: requiredText(1, 120, "Pangalan"),
        role: roleSchema,
      })
      .parse(Object.fromEntries(fd));
    if (input.role === "owner" && ctx.role !== "owner") return toActionError({ message: "owner_role_protected" });

    const admin = authAdmin();
    if (!admin) return { ok: false, error: "Hindi naka-configure ang SUPABASE_SERVICE_ROLE_KEY sa server, kaya hindi makapag-imbita." };
    const { data, error } = await admin.inviteUserByEmail(input.email, {
      redirectTo: siteUrl("/admin/auth/callback?next=/admin/auth/update-password"),
      data: { display_name: input.display_name },
    });
    if (error || !data.user) {
      if (error?.code === "email_exists" || error?.status === 422) return { ok: false, error: "May account na ang email na ito." };
      logServerError("invite_failed", error);
      return { ok: false, error: "Hindi naipadala ang imbitasyon. Suriin ang SMTP configuration ng Supabase Auth." };
    }

    // Role assignment runs as the inviter so every database guard applies.
    const { error: roleError } = await ctx.supabase.rpc("set_user_role", { p_user_id: data.user.id, p_role: input.role });
    if (roleError) {
      const { error: rollbackError } = await admin.deleteUser(data.user.id);
      if (rollbackError) logServerError("invite_rollback_failed", rollbackError);
      const reason = toActionError(roleError).error;
      return {
        ok: false,
        error: rollbackError
          ? `Hindi naitakda ang role (${reason}) at hindi rin natanggal ang na-imbitang account. Tanggalin ito sa Supabase Auth dashboard.`
          : `Hindi naitakda ang role: ${reason} Binawi ang imbitasyon.`,
      };
    }
    revalidatePath("/admin/team");
    return { ok: true, message: `Naipadala ang imbitasyon kay ${input.email}.` };
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
    return { ok: true, message: "Nabago ang role. Epektibo sa susunod na request ng user." };
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
          ? "Na-reactivate sa Studio, pero hindi natanggal ang ban sa Supabase Auth kaya hindi pa makakapag-login ang user. Subukang muli."
          : "Na-deactivate sa Studio (wala na siyang access), pero hindi na-ban sa Supabase Auth. Subukang muli para pigilan ang pag-login.",
      };
    }
    return {
      ok: true,
      message: input.active
        ? "Na-reactivate. Makakapag-login na muli ang user."
        : "Na-deactivate at na-ban sa pag-login. Ang kasalukuyang session ay mawawalan ng bisa kapag nag-expire ang access token nito; wala na itong pahintulot sa Studio.",
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateMemberProfile(_prev: FormActionResult, fd: FormData): Promise<FormActionResult> {
  try {
    const ctx = await getStaffContext();
    if (!ctx) throw new AuthorizationError("Kailangan mong mag-login.");
    const input = z
      .object({ id: userId, display_name: requiredText(1, 120, "Pangalan"), title: optionalText(120), bio: optionalText(2000) })
      .parse(Object.fromEntries(fd));
    if (input.id !== ctx.userId && !ctx.permissions.has("users.manage")) throw new AuthorizationError();
    const { id, ...fields } = input;
    const updated = must(await ctx.supabase.from("profiles").update(fields).eq("id", id).select("id"));
    if (updated.length === 0) throw new AuthorizationError();
    unwrap(await ctx.supabase.rpc("write_audit", { p_action: "update_profile", p_entity_type: "profiles", p_entity_id: id, p_details: { fields: Object.keys(fields) } }));
    revalidatePath("/admin/team");
    revalidatePath(`/admin/team/${id}`);
    return { ok: true, message: "Na-save ang profile." };
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
    return { ok: true, message: changed === 0 ? "Walang binago." : `Na-update ang ${changed} pahintulot ng ${role}.` };
  } catch (e) {
    return toActionError(e);
  }
}
