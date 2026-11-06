import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/public/logo";
import { MainNav } from "@/components/public/main-nav";
import type { NavItem } from "@/lib/cms/site";

/** Navy masthead bar: wordmark, CMS category navigation, search, CTA (Morning reference). */
export function SiteHeader({
  siteName,
  logoUrl,
  items,
  cta,
}: {
  siteName: string;
  logoUrl: string | null;
  items: NavItem[];
  cta: { label: string; href: string } | null;
}) {
  return (
    <header className="sticky top-0 z-40 bg-navy-900 text-white">
      <div className="container-site flex h-16 items-center gap-4 lg:gap-8">
        <Link href="/" className="shrink-0 rounded" aria-label={`${siteName} — Bahay`}>
          <Logo siteName={siteName} logoUrl={logoUrl} size="sm" inverted priority />
        </Link>
        <MainNav items={items} cta={cta}>
          <Link
            href="/hanap"
            className="inline-flex h-11 items-center gap-2 rounded px-2 text-sm text-white/80 transition-colors hover:text-white"
            aria-label="Maghanap"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
            <span className="hidden 2xl:inline">Maghanap ng balita…</span>
          </Link>
        </MainNav>
      </div>
    </header>
  );
}
