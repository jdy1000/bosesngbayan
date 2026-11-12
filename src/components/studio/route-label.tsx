"use client";

import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { findNavItem } from "@/components/studio/nav";

/** Sub-pages that are not nav destinations of their own. */
function pageLabel(path: string): string {
  if (/^\/admin\/articles\/[^/]+\/history$/.test(path)) return "Article history";
  if (/^\/admin\/articles\/[^/]+$/.test(path) && path !== "/admin/articles/new") return "Edit article";
  return findNavItem(path)?.label ?? "Overview";
}

/** Top-bar location: "Workspace / <page>". Below 551px only the icon and the page name stay. */
export function StudioCrumb() {
  const path = usePathname();
  return (
    <p className="flex min-w-0 items-center gap-2.5 whitespace-nowrap text-[13px] text-muted">
      <LayoutGrid className="size-[18px] shrink-0" aria-hidden="true" />
      <span className="hidden min-[551px]:inline">Workspace</span>
      <span aria-hidden="true" className="hidden opacity-50 min-[551px]:inline">
        /
      </span>
      <strong className="truncate font-semibold text-ink-soft">{pageLabel(path)}</strong>
    </p>
  );
}
