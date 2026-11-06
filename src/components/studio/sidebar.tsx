"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  BarChart3,
  ChevronDown,
  FileText,
  FolderTree,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  Mail,
  Menu,
  Navigation,
  Newspaper,
  Search,
  Settings,
  ShieldAlert,
  ScrollText,
  UserRound,
  Users,
  Vote,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/public/logo";
import type { StudioIcon, StudioNavItem } from "@/components/studio/nav";

const ICONS: Record<StudioIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  articles: Newspaper,
  media: ImageIcon,
  homepage: Home,
  pages: FileText,
  taxonomy: FolderTree,
  polls: Vote,
  moderation: ShieldAlert,
  newsletter: Mail,
  analytics: BarChart3,
  team: Users,
  navigation: Navigation,
  seo: Search,
  settings: Settings,
  audit: ScrollText,
  account: UserRound,
};

type Group = { group: string; items: StudioNavItem[] };

function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

// Collapsed groups are a per-browser convenience (localStorage); everything renders open without it.
const STORAGE_KEY = "studio.nav.collapsed";
const CHANGE_EVENT = "studio-nav-collapsed";

function readCollapsed(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useCollapsedGroups(): [Set<string>, (group: string) => void] {
  const raw = useSyncExternalStore(subscribe, readCollapsed, () => "[]");
  let collapsed: Set<string>;
  try {
    collapsed = new Set(JSON.parse(raw) as string[]);
  } catch {
    collapsed = new Set();
  }
  const toggle = (group: string) => {
    const next = new Set(collapsed);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Storage blocked: the toggle simply does not persist.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [collapsed, toggle];
}

function groupId(group: string) {
  return `studio-nav-${group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function NavList({ groups, pathname }: { groups: Group[]; pathname: string }) {
  const [collapsed, toggle] = useCollapsedGroups();
  return (
    <nav aria-label="Studio" className="space-y-3">
      {groups.map((g) => {
        const open = !collapsed.has(g.group);
        const id = groupId(g.group);
        return (
          <div key={g.group}>
            <button
              type="button"
              onClick={() => toggle(g.group)}
              aria-expanded={open}
              aria-controls={id}
              className="flex w-full items-center justify-between rounded-lg px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-white/45 transition-colors hover:bg-white/6 hover:text-white/80"
            >
              {g.group}
              <ChevronDown
                aria-hidden="true"
                className={`size-3.5 transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
              />
            </button>
            <ul id={id} hidden={!open} className="mt-1 space-y-0.5">
              {g.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-white/12 text-white"
                          : "text-white/70 hover:bg-white/6 hover:text-white"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2.5 px-3"
      aria-label="Boses ng Bayan Studio, dashboard"
    >
      <Logo siteName="Boses ng Bayan" inverted size="sm" />
      <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
        Studio
      </span>
    </Link>
  );
}

export function StudioSidebar({ groups }: { groups: Group[] }) {
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
      <aside className="hidden w-64 shrink-0 flex-col gap-5 overflow-y-auto bg-navy py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex">
        <Brand />
        <div className="px-3">
          <NavList groups={groups} pathname={pathname} />
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 inline-flex size-10 items-center justify-center rounded-full bg-navy text-white lg:hidden"
        aria-label="Buksan ang menu"
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
            className="absolute inset-0 bg-navy/50"
            aria-label="Isara ang menu"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-72 flex-col gap-5 overflow-y-auto bg-navy py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-white/80 hover:bg-white/10"
                aria-label="Isara ang menu"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="px-3">
              <NavList groups={groups} pathname={pathname} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
