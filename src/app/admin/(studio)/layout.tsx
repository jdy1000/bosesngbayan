import type { Metadata } from "next";
import Link from "next/link";
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

/**
 * Studio shell. Its measurements follow the Newsmaker console (ADR-021): a 232px sidebar, a 68px top bar,
 * a 1440px content column. `studio` scopes the control styles in globals.css.
 */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const items = STUDIO_NAV.filter((i) => i.anyOf.length === 0 || i.anyOf.some((p) => staff.permissions.has(p)));
  const canSearch = staff.permissions.has("articles.create") || staff.permissions.has("articles.view_all");

  return (
    <div className="studio flex min-h-dvh flex-col bg-surface lg:pl-[232px]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-[7px] focus:bg-paper focus:px-4 focus:py-2 focus:shadow-float">
        Skip to workspace
      </a>
      <StudioSidebar items={items} />
      {/* pl-16 below lg leaves room for the fixed menu button that StudioSidebar renders at the top left. */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-paper pl-16 pr-5 lg:h-[68px] lg:gap-6 lg:px-8">
        <StudioCrumb />
        <div className="ml-auto flex min-w-0 items-center gap-3 lg:gap-6">
          {canSearch && (
            <form
              action="/admin/articles"
              method="get"
              role="search"
              className="hidden w-[min(270px,28vw)] items-center rounded-[7px] border border-line bg-surface pl-3 pr-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 min-[1181px]:flex"
            >
              <label htmlFor="studio-search" className="sr-only">
                Search articles in workspace
              </label>
              <input id="studio-search" name="q" type="search" placeholder="Search articles…" className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none" />
              <button type="submit" aria-label="Search articles" className="rounded bg-surface-2 px-[7px] py-[3px] text-xs text-ink-soft hover:text-ink">
                ↵
              </button>
            </form>
          )}
          <Link href="/admin/account" className="flex max-w-[260px] items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-surface" aria-label={`My account: ${staff.displayName}, ${ROLE_LABELS[staff.role]}`}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700" aria-hidden="true">
              {staff.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden min-w-0 text-left min-[551px]:block" aria-hidden="true">
              <span className="block max-w-[140px] truncate text-[13px] font-semibold leading-tight text-ink">{staff.displayName}</span>
              <span className="mt-0.5 block text-[11px] leading-tight text-muted">{ROLE_LABELS[staff.role]}</span>
            </span>
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-8 pt-[25px] lg:px-8 lg:pb-10 lg:pt-8">
        {children}
      </main>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-line px-5 py-5 text-xs text-muted lg:px-8">
        <span>Boses ng Bayan</span>
        <span>Editorial workspace · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
