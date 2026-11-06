import type { Permission } from "@/lib/auth/permissions";

export interface StudioNavItem {
  href: string;
  label: string;
  icon: StudioIcon;
  /** Shown when the user has ANY of these (empty = everyone). UX only — every page and action re-checks on the server. */
  anyOf: Permission[];
}

export type StudioIcon =
  | "dashboard" | "articles" | "media" | "homepage" | "pages" | "taxonomy" | "polls" | "moderation"
  | "newsletter" | "analytics" | "team" | "navigation" | "seo" | "settings" | "audit" | "account";

export const STUDIO_NAV: { group: string; items: StudioNavItem[] }[] = [
  {
    group: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: "dashboard", anyOf: ["dashboard.view"] },
      { href: "/admin/analytics", label: "Analytics", icon: "analytics", anyOf: ["analytics.view"] },
    ],
  },
  {
    group: "Content",
    items: [
      { href: "/admin/articles", label: "Articles", icon: "articles", anyOf: ["articles.create", "articles.view_all"] },
      { href: "/admin/pages", label: "Pages", icon: "pages", anyOf: ["pages.manage"] },
      { href: "/admin/media", label: "Media Library", icon: "media", anyOf: ["media.upload", "media.manage_any"] },
      { href: "/admin/taxonomy", label: "Categories & tags", icon: "taxonomy", anyOf: ["taxonomy.manage"] },
    ],
  },
  {
    group: "Homepage & site",
    items: [
      { href: "/admin/homepage", label: "Homepage Builder", icon: "homepage", anyOf: ["homepage.manage"] },
      { href: "/admin/navigation", label: "Navigation", icon: "navigation", anyOf: ["navigation.manage"] },
      { href: "/admin/seo", label: "SEO & redirects", icon: "seo", anyOf: ["seo.manage"] },
    ],
  },
  {
    group: "Community",
    items: [
      { href: "/admin/polls", label: "Polls", icon: "polls", anyOf: ["polls.manage", "polls.view_results"] },
      { href: "/admin/moderation", label: "Moderation", icon: "moderation", anyOf: ["moderation.manage"] },
      { href: "/admin/newsletter", label: "Newsletter", icon: "newsletter", anyOf: ["newsletter.view", "newsletter.manage"] },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/admin/team", label: "Team & roles", icon: "team", anyOf: ["users.view", "users.manage"] },
      { href: "/admin/settings", label: "Site Settings", icon: "settings", anyOf: ["settings.manage"] },
      { href: "/admin/audit", label: "Audit Log", icon: "audit", anyOf: ["audit.view"] },
    ],
  },
  {
    group: "You",
    // Empty anyOf = every signed-in staff member (own account only; enforced in the account actions).
    items: [{ href: "/admin/account", label: "My account", icon: "account", anyOf: [] }],
  },
];
