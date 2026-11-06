"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouteOpen } from "@/components/use-route-open";
import {
  BarChart3, FileText, FolderTree, Home, Image as ImageIcon, LayoutDashboard, Mail, Menu, Navigation, Newspaper,
  Search, Settings, ShieldAlert, ScrollText, Users, Vote, X, type LucideIcon,
} from "lucide-react";
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
};

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export function StudioSidebar({ groups, footer }: { groups: { group: string; items: StudioNavItem[] }[]; footer: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useRouteOpen();

  const nav = (
    <nav aria-label="Studio" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {groups.map((g) => (
        <div key={g.group}>
          <p className="px-3 pb-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white/45">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                      active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/6 hover:text-white"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-navy px-4 text-white lg:hidden">
        <Link href="/admin" className="font-serif text-lg font-bold">
          Boses ng Bayan <span className="font-sans text-xs font-bold uppercase tracking-widest text-white/60">Studio</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="studio-sidebar"
          aria-label={open ? "Isara ang menu" : "Buksan ang menu"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <aside
        id="studio-sidebar"
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-40 w-64 flex-col bg-navy text-white lg:sticky lg:top-0 lg:flex lg:h-dvh`}
      >
        <Link href="/admin" className="hidden h-16 items-center gap-2 border-b border-white/10 px-6 lg:flex">
          <span className="font-serif text-xl font-bold">Boses ng Bayan</span>
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-white/55">Studio</span>
        </Link>
        {nav}
        <div className="border-t border-white/10 p-4">{footer}</div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
    </>
  );
}
