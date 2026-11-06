import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/public/logo";
import { DesktopNav, MainNav } from "@/components/public/main-nav";
import type { NavItem } from "@/lib/cms/site";
import { LanguageSwitch, ThemeToggle } from "@/components/preference-switches";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import type { Theme } from "@/lib/theme";

/** Navy masthead: wordmark, search and CTA; on lg+ a second row carries the CMS category navigation (Morning reference). */
export function SiteHeader({
  siteName,
  logoUrl,
  items,
  cta,
  locale,
  theme,
  t,
}: {
  siteName: string;
  logoUrl: string | null;
  items: NavItem[];
  cta: { label: string; href: string } | null;
  locale: Locale;
  theme: Theme;
  t: Messages["common"];
}) {
  const extras = (
    <>
      <LanguageSwitch locale={locale} labels={t.language} />
      <ThemeToggle
        theme={theme}
        labels={t.theme}
        className="inline-flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      />
    </>
  );
  return (
    <header className="sticky top-0 z-40 bg-navy-900 text-white">
      <div className="container-site flex h-16 items-center gap-4">
        <Link href="/" className="shrink-0 rounded" aria-label={`${siteName} — ${t.homeSuffix}`}>
          <Logo siteName={siteName} logoUrl={logoUrl} size="sm" inverted priority />
        </Link>
        <MainNav items={items} cta={cta} extras={extras}>
          <Link
            href="/hanap"
            className="inline-flex h-11 items-center gap-2 rounded px-2 text-sm text-white/80 transition-colors hover:text-white"
            aria-label={t.search}
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
            <span className="hidden 2xl:inline">{t.searchPlaceholder}</span>
          </Link>
        </MainNav>
      </div>
      {items.length > 0 && (
        <div className="hidden border-t border-white/10 lg:block">
          <div className="container-site">
            <DesktopNav items={items} />
          </div>
        </div>
      )}
    </header>
  );
}
