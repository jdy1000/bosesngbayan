import "server-only";
import { redirect } from "next/navigation";
import { requireStaffPage, type StaffContext } from "@/lib/auth/session";

/** Media pages are open to anyone who may upload or manage media (same rule as the Studio nav). */
export async function requireAnyPermissionPage(): Promise<StaffContext> {
  const ctx = await requireStaffPage();
  if (!ctx.permissions.has("media.upload") && !ctx.permissions.has("media.manage_any")) redirect("/admin?denied=1");
  return ctx;
}
