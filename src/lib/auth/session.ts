import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { isPermission, type AppRole, type Permission } from "@/lib/auth/permissions";

export interface StaffContext {
  userId: string;
  email: string | null;
  displayName: string;
  role: AppRole;
  permissions: ReadonlySet<Permission>;
  supabase: Awaited<ReturnType<typeof createSessionClient>>;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission for this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Resolve the signed-in staff member from the verified Supabase session (getUser() validates the
 * JWT with the Auth server) and the database role/permission tables. Never trusts client claims.
 * Returns null for anonymous users, deactivated staff, or accounts without a role.
 */
export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const supabase = await createSessionClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const [{ data: profile }, { data: roleRow }, { data: perms }] = await Promise.all([
    supabase.from("profiles").select("display_name, is_active").eq("id", userData.user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userData.user.id).maybeSingle(),
    supabase.rpc("my_permissions"),
  ]);
  if (!profile || !profile.is_active || !roleRow) return null;

  const permissions = new Set<Permission>();
  for (const p of (perms as string[] | null) ?? []) {
    if (isPermission(p)) permissions.add(p);
  }

  return {
    userId: userData.user.id,
    email: userData.user.email ?? null,
    displayName: profile.display_name,
    role: roleRow.role as AppRole,
    permissions,
    supabase,
  };
});

/** For Studio pages: redirect to login when signed out; to the dashboard when not permitted. */
export async function requireStaffPage(permission?: Permission): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/admin/login");
  if (permission && !ctx.permissions.has(permission)) redirect("/admin?denied=1");
  return ctx;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requirePermission(...required: Permission[]): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) throw new AuthorizationError("You need to sign in.");
  for (const p of required) {
    if (!ctx.permissions.has(p)) throw new AuthorizationError();
  }
  return ctx;
}

/** At least one of the given permissions. */
export async function requireAnyPermission(...anyOf: Permission[]): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) throw new AuthorizationError("You need to sign in.");
  if (!anyOf.some((p) => ctx.permissions.has(p))) throw new AuthorizationError();
  return ctx;
}
