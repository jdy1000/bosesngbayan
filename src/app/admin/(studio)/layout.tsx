import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { StudioSidebar } from "@/components/studio/sidebar";
import { STUDIO_NAV } from "@/components/studio/nav";
import { StudioCrumb } from "@/components/studio/route-label";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { requireStaffPage } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Boses ng Bayan Studio", template: "%s — Studio" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const items = STUDIO_NAV.filter((i) => i.anyOf.length === 0 || i.anyOf.some((p) => staff.permissions.has(p)));
  const canSearch = staff.permissions.has("articles.create") || staff.permissions.has("articles.view_all");

  return (
    <div className="flex min-h-dvh flex-col bg-surface lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:shadow-float">
        Skip to workspace
      </a>
      <StudioSidebar items={items} />
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-line bg-paper px-4 pl-16 sm:px-6 lg:pl-6">
        <StudioCrumb />
        <div className="ml-auto flex min-w-0 items-center gap-1">
          {canSearch && (
            <form action="/admin/articles" method="get" role="search" className="relative mr-2 hidden w-72 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <label htmlFor="studio-search" className="sr-only">
                Search articles
              </label>
              <input
                id="studio-search"
                name="q"
                type="search"
                placeholder="Search articles…"
                className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-10 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              />
              <button type="submit" aria-label="Search articles" className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink">
                ↵
              </button>
            </form>
          )}
          <Link href="/admin/account" className="ml-1 flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-surface-2" aria-label={`My account: ${staff.displayName}, ${ROLE_LABELS[staff.role]}`}>
            <span className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white" aria-hidden="true">
              {staff.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden text-left sm:block" aria-hidden="true">
              <span className="block text-sm font-semibold leading-tight text-navy">{staff.displayName}</span>
              <span className="block text-xs leading-tight text-muted">{ROLE_LABELS[staff.role]}</span>
            </span>
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        {children}
      </main>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-line px-4 py-4 text-xs text-muted sm:px-6">
        <span>Boses ng Bayan</span>
        <span>Editorial workspace · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
