"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CheckCheck,
  ExternalLink,
  Flag,
  FolderTree,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  Newspaper,
  Plus,
  SlidersHorizontal,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/public/logo";
import { findNavItem, type StudioIcon, type StudioNavItem } from "@/components/studio/nav";
import { signOut } from "@/app/admin/login/actions";

const ICONS: Record<StudioIcon, LucideIcon> = {
  overview: LayoutGrid,
  analytics: BarChart3,
  articles: Newspaper,
  review: CheckCheck,
  reports: Flag,
  ads: Megaphone,
  audience: Users,
  users: UserCog,
  applications: UserPlus,
  categories: FolderTree,
  settings: SlidersHorizontal,
  create: Plus,
  account: ShieldCheck,
};

/**
 * One row of the sidebar: 7px corners, 20px icon, as in the Newsmaker console (ADR-021). Rows are 40px with 4px gaps,
 * not Newsmaker's 44px and 6px: Boses has two more entries (Analytics, Settings) and all 13 must fit a 900px-tall screen.
 */
const ROW = "flex min-h-10 w-full items-center gap-3 rounded-[7px] px-3 py-2 text-sm font-semibold transition-colors";

function NavList({ items, pathname }: { items: StudioNavItem[]; pathname: string }) {
  const activeHref = findNavItem(pathname)?.href;
  return (
    <nav aria-label="Admin navigation">
      <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Publication</p>
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.href === activeHref;
          return (
            <li key={item.href}>
              {/* The current page gets a tint and a 3px bar on its left edge, so it does not rely on colour alone. */}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${ROW} ${active ? "bg-brand-50 text-brand-700 shadow-[inset_3px_0_0_var(--color-brand)]" : "text-ink-soft hover:bg-surface"}`}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Bottom of the sidebar: who this space is for, the public site, and sign-out. */
function SidebarFooter() {
  const row = `${ROW} text-ink-soft hover:bg-surface`;
  return (
    <div className="mt-4 shrink-0 space-y-1 px-4">
      <p className="flex items-start gap-3 border-t border-line px-2.5 pb-2.5 pt-[18px] text-xs text-ink-soft">
        <ShieldCheck className="size-[19px] shrink-0" aria-hidden="true" />
        <span>
          <span className="block">Private workspace</span>
          <span className="block text-[11px] text-muted">Authorized editors only</span>
        </span>
      </p>
      <a href={process.env.NEXT_PUBLIC_SITE_URL || "/"} target="_blank" rel="noopener noreferrer" className={row}>
        <ExternalLink className="size-[18px] shrink-0" aria-hidden="true" /> View publication
      </a>
      <form action={signOut}>
        <button type="submit" className={row}>
          <LogOut className="size-[18px] shrink-0" aria-hidden="true" /> Sign out
        </button>
      </form>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-[11px] px-[21px]" aria-label="Boses ng Bayan Studio, dashboard">
      <Logo siteName="Boses ng Bayan" size="sm" />
      <span className="leading-none">
        <span className="block text-base font-bold tracking-[-0.6px] text-ink">Studio</span>
        <span className="mt-[5px] block text-[9px] font-medium uppercase tracking-[1px] text-muted">Editorial workspace</span>
      </span>
    </Link>
  );
}

export function StudioSidebar({ items }: { items: StudioNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  // Close the drawer after navigation (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus(); // back to where the keyboard user came from
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-line bg-paper pb-[18px] pt-[25px] lg:fixed lg:inset-y-0 lg:left-0 lg:flex">
        <Brand />
        <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-4 [scrollbar-width:thin]">
          <NavList items={items} pathname={pathname} />
        </div>
        <SidebarFooter />
      </aside>

      <button
        ref={menuButton}
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 inline-flex size-10 items-center justify-center rounded-[7px] text-ink-soft hover:bg-surface lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="size-[22px]" aria-hidden="true" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Studio menu">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-[min(86vw,280px)] flex-col bg-paper pb-[18px] pt-[25px] shadow-float motion-safe:animate-[studio-drawer-in_200ms_ease-out]">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} className="rounded-[7px] p-2 text-ink-soft hover:bg-surface" aria-label="Close menu">
                <X className="size-[22px]" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-7 min-h-0 flex-1 overflow-y-auto px-4 [scrollbar-width:thin]">
              <NavList items={items} pathname={pathname} />
            </div>
            <SidebarFooter />
          </div>
        </div>
      ) : null}
    </>
  );
}
