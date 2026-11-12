import { ToolbarTabs } from "@/components/studio/ui";

const TABS = [
  { href: "/admin/taxonomy", label: "Categories" },
  { href: "/admin/taxonomy/tags", label: "Tags" },
  { href: "/admin/taxonomy/locations", label: "Locations" },
  { href: "/admin/taxonomy/trending", label: "Trending topics" },
] as const;

/** Section tabs above every taxonomy page, in the kit's pill-tab look. */
export function TaxonomyTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <div className="mb-5">
      <ToolbarTabs label="Taxonomy" tabs={TABS.map((t) => ({ key: t.href, label: t.label, href: t.href, current: t.href === current }))} />
    </div>
  );
}
