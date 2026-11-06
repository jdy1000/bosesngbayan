import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ExternalLink, LogOut, Search, UserRound } from "lucide-react";
import { StudioSidebar } from "@/components/studio/sidebar";
import { STUDIO_NAV } from "@/components/studio/nav";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { requireStaffPage } from "@/lib/auth/session";
import { getStudioNotices } from "@/lib/studio/notices";
import { signOut } from "@/app/admin/login/actions";
import { ThemeToggle } from "@/components/preference-switches";
import { getTheme } from "@/lib/theme-server";

export const metadata: Metadata = {
  title: { default: "Boses ng Bayan Studio", template: "%s — Studio" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const menuItem = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-surface";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const groups = STUDIO_NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.anyOf.length === 0 || i.anyOf.some((p) => staff.permissions.has(p))) })).filter(
    (g) => g.items.length > 0,
  );
  const [notices, theme] = await Promise.all([getStudioNotices(staff), getTheme()]);
  const total = notices.reduce((sum, n) => sum + n.count, 0);
  const canSearch = staff.permissions.has("articles.create") || staff.permissions.has("articles.view_all");

  return (
    <div className="min-h-dvh bg-surface lg:pl-64">
      <StudioSidebar groups={groups} />
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-paper px-4 pl-16 sm:px-6 lg:pl-6">
        {canSearch && (
          <form action="/admin/articles" method="get" role="search" className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <label htmlFor="studio-search" className="sr-only">
              Search articles
            </label>
            <input
              id="studio-search"
              name="q"
              type="search"
              placeholder="Search articles…"
              className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-4 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
          </form>
        )}
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle
            theme={theme}
            labels={{ toDark: "Use dark mode", toLight: "Use light mode" }}
            className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-brand-50"
          />
          <details className="relative">
            <summary
              className="relative flex size-10 cursor-pointer list-none items-center justify-center rounded-full text-ink hover:bg-brand-50"
              aria-label={`Notifications (${total})`}
            >
              <Bell className="size-5" aria-hidden="true" />
              {total > 0 && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-accent ring-2 ring-paper" aria-hidden="true" />}
            </summary>
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-paper p-2 text-sm shadow-float ring-1 ring-line">
              {notices.length === 0 ? (
                <p className="px-3 py-2 text-muted">Nothing is waiting for you.</p>
              ) : (
                notices.map((n) => (
                  <Link key={n.href} href={n.href} className="block rounded-xl px-3 py-2 hover:bg-surface">
                    <span className="font-semibold tabular-nums text-ink">{n.count}</span> {n.label}
                  </Link>
                ))
              )}
            </div>
          </details>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-brand-50">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white" aria-hidden="true">
                {staff.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-semibold leading-tight text-navy">{staff.displayName}</span>
                <span className="block text-xs leading-tight text-muted">{ROLE_LABELS[staff.role]}</span>
              </span>
            </summary>
            <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-paper p-2 text-sm shadow-float ring-1 ring-line">
              <p className="truncate px-3 py-2 text-xs text-muted">{staff.email}</p>
              <Link href="/admin/account" className={menuItem}>
                <UserRound className="size-4" aria-hidden="true" /> My account
              </Link>
              <Link href="/" target="_blank" className={menuItem}>
                <ExternalLink className="size-4" aria-hidden="true" /> Open site
              </Link>
              <form action={signOut}>
                <button type="submit" className={`${menuItem} text-accent-700 hover:bg-red-50`}>
                  <LogOut className="size-4" aria-hidden="true" /> Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}
