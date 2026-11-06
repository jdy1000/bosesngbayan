import type { Metadata } from "next";
import Link from "next/link";
import { StudioSidebar } from "@/components/studio/sidebar";
import { STUDIO_NAV } from "@/components/studio/nav";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { requireStaffPage } from "@/lib/auth/session";
import { signOut } from "@/app/admin/login/actions";

export const metadata: Metadata = {
  title: { default: "Boses ng Bayan Studio", template: "%s — Studio" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const groups = STUDIO_NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.anyOf.some((p) => staff.permissions.has(p))) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <div className="min-h-dvh bg-surface lg:flex">
      <StudioSidebar
        groups={groups}
        footer={
          <div className="space-y-3 text-sm">
            <div>
              <p className="truncate font-semibold text-white">{staff.displayName}</p>
              <p className="text-xs text-white/60">{ROLE_LABELS[staff.role]}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/" target="_blank" className="text-xs font-semibold text-white/70 hover:text-white">
                Buksan ang site ↗
              </Link>
              <form action={signOut} className="ml-auto">
                <button type="submit" className="text-xs font-semibold text-white/70 hover:text-white">
                  Mag-logout
                </button>
              </form>
            </div>
          </div>
        }
      />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
