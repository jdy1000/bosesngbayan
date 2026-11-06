"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useRouteOpen } from "@/components/use-route-open";
import { ChevronDown, Menu, X } from "lucide-react";
import type { NavItem } from "@/lib/cms/site";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (/^https?:/.test(href)) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, className }: { item: NavItem; pathname: string; className: string }) {
  const active = isActive(pathname, item.href);
  const external = item.openInNewTab || /^https?:/.test(item.href);
  return (
    <Link
      href={item.href}
      className={className}
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {item.label}
    </Link>
  );
}

function DesktopGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const active = isActive(pathname, item.href) || item.children.some((c) => isActive(pathname, c.href));
  return (
    <li className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        data-active={active || undefined}
        className="nav-link inline-flex items-center gap-1"
      >
        {item.label}
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      <ul
        id={id}
        hidden={!open}
        className="absolute left-0 top-full z-50 mt-1 min-w-52 rounded-xl bg-white p-2 shadow-[var(--shadow-float)]"
      >
        <li>
          <NavLink item={item} pathname={pathname} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-brand-50" />
        </li>
        {item.children.map((c) => (
          <li key={c.id}>
            <NavLink item={c} pathname={pathname} className="block rounded-lg px-3 py-2 text-sm hover:bg-brand-50" />
          </li>
        ))}
      </ul>
    </li>
  );
}

export function MainNav({
  items,
  cta,
  children,
}: {
  items: NavItem[];
  cta: { label: string; href: string } | null;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useRouteOpen();
  const panelId = useId();

  // Close the mobile menu on Escape (navigation closes it via useRouteOpen).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  return (
    <>
      <nav aria-label="Pangunahing navigation" className="hidden min-w-0 flex-1 lg:flex">
        <ul className="flex items-center">
          {items.map((item) =>
            item.children.length > 0 ? (
              <DesktopGroup key={item.id} item={item} pathname={pathname} />
            ) : (
              <li key={item.id}>
                <NavLink item={item} pathname={pathname} className="nav-link" />
              </li>
            ),
          )}
        </ul>
      </nav>
      <div className="ml-auto flex items-center gap-2 lg:ml-0">
        {children}
        {cta && (
          <Link href={cta.href} className="btn hidden min-h-9 bg-accent px-4 text-white hover:bg-accent-700 sm:inline-flex">
            {cta.label}
          </Link>
        )}
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded text-white hover:bg-white/10 lg:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Isara ang menu" : "Buksan ang menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      <div
        id={panelId}
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-white px-4 pb-10 pt-4 lg:hidden"
      >
        <nav aria-label="Mobile navigation">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.id} className="border-b border-line/70">
                <NavLink
                  item={item}
                  pathname={pathname}
                  className="flex min-h-14 items-center text-lg font-semibold text-ink data-[active]:text-brand"
                />
                {item.children.length > 0 && (
                  <ul className="pb-3 pl-4">
                    {item.children.map((c) => (
                      <li key={c.id}>
                        <NavLink item={c} pathname={pathname} className="flex min-h-11 items-center text-base text-ink-soft data-[active]:text-brand" />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {cta && (
            <Link href={cta.href} className="btn mt-6 w-full bg-accent text-white hover:bg-accent-700">
              {cta.label}
            </Link>
          )}
        </nav>
      </div>
      <style>{`
        .nav-link { position: relative; display: inline-flex; align-items: center; min-height: 44px; padding: 0 0.7rem;
          font-size: 0.74rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
          color: rgb(255 255 255 / 0.82); white-space: nowrap; transition: color 150ms ease; }
        .nav-link:hover, .nav-link[data-active] { color: #fff; }
        .nav-link[data-active]::after { content: ""; position: absolute; left: 0.7rem; right: 0.7rem; bottom: 6px;
          height: 2px; background: var(--color-accent); }
      `}</style>
    </>
  );
}
