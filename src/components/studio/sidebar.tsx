"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

function NavList({ items, pathname }: { items: StudioNavItem[]; pathname: string }) {
  const activeHref = findNavItem(pathname)?.href;
  return (
    <nav aria-label="Admin navigation">
      <p className="px-3 pb-2 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted">Publication</p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.href === activeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-surface-2 font-semibold text-brand-700" : "font-medium text-ink-soft hover:bg-surface hover:text-ink"
                }`}
              >
                <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
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
  const row = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface hover:text-ink";
  return (
    <div className="shrink-0 space-y-1 border-t border-line px-3 pt-4">
      <p className="flex items-start gap-3 px-3 pb-2 text-xs text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="block font-semibold text-ink-soft">Private workspace</span>
          Authorized editors only
        </span>
      </p>
      <a href={process.env.NEXT_PUBLIC_SITE_URL || "/"} target="_blank" rel="noopener noreferrer" className={row}>
        <ExternalLink className="size-4 shrink-0" aria-hidden="true" /> View publication
      </a>
      <form action={signOut}>
        <button type="submit" className={`${row} hover:text-accent-700`}>
          <LogOut className="size-4 shrink-0" aria-hidden="true" /> Sign out
        </button>
      </form>
    </div>
  );
}

function Brand() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2.5 px-3"
      aria-label="Boses ng Bayan Studio, dashboard"
    >
      <Logo siteName="Boses ng Bayan" size="sm" />
      <span className="leading-tight">
        <span className="block text-sm font-bold text-navy">Studio</span>
        <span className="block text-xs text-muted">Editorial workspace</span>
      </span>
    </Link>
  );
}

export function StudioSidebar({ items }: { items: StudioNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the drawer after navigation (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col gap-5 border-r border-line bg-paper py-5 lg:fixed lg:inset-y-0 lg:left-0 lg:flex">
        <Brand />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 [scrollbar-width:thin]">
          <NavList items={items} pathname={pathname} />
        </div>
        <SidebarFooter />
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-surface-2 lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Studio menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-72 flex-col gap-5 bg-paper py-5 shadow-float">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-ink-soft hover:bg-surface-2"
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 [scrollbar-width:thin]">
              <NavList items={items} pathname={pathname} />
            </div>
            <SidebarFooter />
          </div>
        </div>
      ) : null}
    </>
  );
}
