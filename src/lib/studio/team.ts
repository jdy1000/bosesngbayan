import "server-only";
import type { StaffContext } from "@/lib/auth/session";
import { unwrap } from "@/lib/actions";
import { ROLES, type AppRole } from "@/lib/auth/permissions";
import { must } from "@/lib/studio/db";

export interface TeamMember {
  id: string;
  displayName: string;
  title: string | null;
  role: AppRole;
  isActive: boolean;
  deactivatedAt: string | null;
  assignedAt: string;
  email: string | null;
  invitedAt: string | null;
  confirmedAt: string | null;
  lastSignInAt: string | null;
}

/** Staff = profiles with a role. Email/sign-in data come from staff_directory() (users.view only). */
export async function loadTeam(ctx: StaffContext): Promise<TeamMember[]> {
  const [roles, directory] = await Promise.all([
    ctx.supabase
      .from("user_roles")
      .select("user_id, role, assigned_at, profile:profiles!user_roles_user_id_fkey(display_name, title, is_active, deactivated_at)")
      .order("assigned_at"),
    ctx.supabase.rpc("staff_directory"),
  ]);
  const dir = new Map((unwrap(directory) ?? []).map((d) => [d.user_id, d]));
  type Row = { user_id: string; role: AppRole; assigned_at: string; profile: { display_name: string; title: string | null; is_active: boolean; deactivated_at: string | null } | null };
  return (unwrap(roles) as unknown as Row[])
    .filter((r) => r.profile)
    .map((r) => {
      const d = dir.get(r.user_id);
      return {
        id: r.user_id,
        displayName: r.profile!.display_name,
        title: r.profile!.title,
        role: r.role,
        isActive: r.profile!.is_active,
        deactivatedAt: r.profile!.deactivated_at,
        assignedAt: r.assigned_at,
        email: d?.email ?? null,
        invitedAt: d?.invited_at ?? null,
        confirmedAt: d?.confirmed_at ?? null,
        lastSignInAt: d?.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.displayName.localeCompare(b.displayName));
}

export interface PermissionMatrix {
  permissions: { key: string; group_name: string; description: string }[];
  granted: Set<string>; // `${role}:${permission}`
}

export async function loadPermissionMatrix(ctx: StaffContext): Promise<PermissionMatrix> {
  const [perms, grants] = await Promise.all([
    ctx.supabase.from("permissions").select("key, group_name, description").order("group_name").order("key"),
    ctx.supabase.from("role_permissions").select("role, permission"),
  ]);
  return { permissions: must(perms), granted: new Set(must(grants).map((g) => `${g.role}:${g.permission}`)) };
}

/** Roles the caller may assign. The database enforces the same rule (owner_role_protected). */
export function assignableRoles(callerRole: AppRole): AppRole[] {
  return callerRole === "owner" ? [...ROLES] : ROLES.filter((r) => r !== "owner");
}
