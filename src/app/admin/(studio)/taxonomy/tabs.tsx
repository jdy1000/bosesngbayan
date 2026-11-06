import Link from "next/link";

const TABS = [
  { href: "/admin/taxonomy", label: "Mga kategorya" },
  { href: "/admin/taxonomy/tags", label: "Mga tag" },
  { href: "/admin/taxonomy/locations", label: "Mga lokasyon" },
  { href: "/admin/taxonomy/trending", label: "Trending topics" },
] as const;

export function TaxonomyTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Taxonomy" className="mb-5 flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${t.href === current ? "bg-navy text-white" : "border border-line bg-white text-ink-soft hover:border-brand"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
