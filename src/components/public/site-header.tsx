import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/public/logo";
import { MainNav } from "@/components/public/main-nav";
import type { NavItem } from "@/lib/cms/site";

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
    <header className="sticky top-0 z-40 bg-white/95 shadow-[0_1px_0_rgb(15_27_61/0.06)] supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:backdrop-blur">
      <div className="container-site flex h-[76px] items-center gap-6 lg:h-[84px]">
        <Link href="/" className="shrink-0 rounded-md" aria-label={`${siteName} — Bahay`}>
          <Logo siteName={siteName} logoUrl={logoUrl} />
        </Link>
        <MainNav items={items} cta={cta}>
          <Link
            href="/hanap"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-50 hover:text-brand"
            aria-label="Maghanap"
          >
            <Search className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </MainNav>
      </div>
    </header>
  );
}
