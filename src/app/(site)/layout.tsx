import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PageViewTracker } from "@/components/public/page-view-tracker";
import { getMediaById, getMenu, getSiteSettings, listCategories } from "@/lib/cms/site";
import { mediaUrl } from "@/lib/media";
import { I18nProvider } from "@/components/public/i18n-provider";
import { getI18n } from "@/lib/i18n/server";
import { localizeSettings } from "@/lib/settings/schema";
import { getTheme } from "@/lib/theme-server";

// Public pages read live CMS data per request (see docs/ARCHITECTURE.md ADR-004).
export const dynamic = "force-dynamic";

/** A favicon chosen in Studio → Settings replaces the default icon; any lookup failure keeps the default. */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const id = (await getSiteSettings()).general.favicon_media_id;
    const url = id ? mediaUrl(await getMediaById(id)) : null;
    return url ? { icons: { icon: url, apple: url } } : {};
  } catch {
    return {};
  }
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, t }, theme] = await Promise.all([getI18n(), getTheme()]);
  const settings = localizeSettings(await getSiteSettings(), locale);
  const [header, footerMain, footerLegal, categories, logo] = await Promise.all([
    getMenu("header", locale),
    getMenu("footer_main", locale),
    getMenu("footer_legal", locale),
    listCategories(),
    getMediaById(settings.general.logo_media_id),
  ]);
  const logoUrl = mediaUrl(logo);
  const { brand } = settings.general;
  // Brand colours are CMS-managed; validated as #rrggbb by the settings schema before reaching CSS.
  const brandVars = `:root{--brand-primary:${brand.primary};--brand-navy:${brand.navy};--brand-accent:${brand.accent};}`;

  return (
    <I18nProvider locale={locale} messages={t}>
      <style>{brandVars}</style>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2 focus:shadow-lg">
        {t.common.skipToContent}
      </a>
      <SiteHeader
        siteName={settings.general.site_name}
        logoUrl={logoUrl}
        items={header}
        cta={settings.general.header_cta}
        locale={locale}
        theme={theme}
        t={t.common}
      />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter settings={settings} logoUrl={logoUrl} mainLinks={footerMain} legalLinks={footerLegal} categories={categories} />
      <PageViewTracker />
    </I18nProvider>
  );
}
