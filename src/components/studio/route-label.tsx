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

/** Top-bar location: "Workspace / <page>". */
export function StudioCrumb() {
  const path = usePathname();
  return (
    <p className="flex min-w-0 items-center gap-2 text-sm">
      <LayoutGrid className="hidden size-4 shrink-0 text-muted sm:block" aria-hidden="true" />
      <span className="hidden text-muted sm:inline">Workspace</span>
      <span aria-hidden="true" className="hidden text-line sm:inline">
        /
      </span>
      <strong className="truncate font-semibold text-ink">{pageLabel(path)}</strong>
    </p>
  );
}
