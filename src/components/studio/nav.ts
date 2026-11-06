import type { Permission } from "@/lib/auth/permissions";

export interface StudioNavItem {
  href: string;
  label: string;
  icon: StudioIcon;
  /** Shown when the user has ANY of these. UX only — every page and action re-checks on the server. */
  anyOf: Permission[];
}

export type StudioIcon =
  | "dashboard" | "articles" | "media" | "homepage" | "pages" | "taxonomy" | "polls" | "moderation"
  | "newsletter" | "analytics" | "team" | "navigation" | "seo" | "settings" | "audit";

export const STUDIO_NAV: { group: string; items: StudioNavItem[] }[] = [
  {
    group: "Newsroom",
    items: [
      { href: "/admin", label: "Dashboard", icon: "dashboard", anyOf: ["dashboard.view"] },
      { href: "/admin/articles", label: "Mga Artikulo", icon: "articles", anyOf: ["articles.create", "articles.view_all"] },
      { href: "/admin/media", label: "Media Library", icon: "media", anyOf: ["media.upload", "media.manage_any"] },
      { href: "/admin/taxonomy", label: "Kategorya at Tag", icon: "taxonomy", anyOf: ["taxonomy.manage"] },
      { href: "/admin/pages", label: "Mga Pahina", icon: "pages", anyOf: ["pages.manage"] },
    ],
  },
  {
    group: "Site",
    items: [
      { href: "/admin/homepage", label: "Homepage Builder", icon: "homepage", anyOf: ["homepage.manage"] },
      { href: "/admin/navigation", label: "Navigation", icon: "navigation", anyOf: ["navigation.manage"] },
      { href: "/admin/seo", label: "SEO at Redirects", icon: "seo", anyOf: ["seo.manage"] },
      { href: "/admin/settings", label: "Site Settings", icon: "settings", anyOf: ["settings.manage"] },
    ],
  },
  {
    group: "Komunidad",
    items: [
      { href: "/admin/polls", label: "Mga Botohan", icon: "polls", anyOf: ["polls.manage", "polls.view_results"] },
      { href: "/admin/moderation", label: "Moderation", icon: "moderation", anyOf: ["moderation.manage"] },
      { href: "/admin/newsletter", label: "Newsletter", icon: "newsletter", anyOf: ["newsletter.view", "newsletter.manage"] },
    ],
  },
  {
    group: "Pamamahala",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: "analytics", anyOf: ["analytics.view"] },
      { href: "/admin/team", label: "Team at Roles", icon: "team", anyOf: ["users.view", "users.manage"] },
      { href: "/admin/audit", label: "Audit Log", icon: "audit", anyOf: ["audit.view"] },
    ],
  },
];
