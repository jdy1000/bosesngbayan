import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { PageViewTracker } from "@/components/public/page-view-tracker";
import { getMediaById, getMenu, getSiteSettings, listCategories } from "@/lib/cms/site";
import { mediaUrl } from "@/lib/media";

// Public pages read live CMS data per request (see docs/ARCHITECTURE.md ADR-004).
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  const [header, footerMain, footerLegal, categories, logo] = await Promise.all([
    getMenu("header"),
    getMenu("footer_main"),
    getMenu("footer_legal"),
    listCategories(),
    getMediaById(settings.general.logo_media_id),
  ]);
  const logoUrl = mediaUrl(logo);
  const { brand } = settings.general;
  // Brand colours are CMS-managed; validated as #rrggbb by the settings schema before reaching CSS.
  const brandVars = `:root{--brand-primary:${brand.primary};--brand-navy:${brand.navy};--brand-accent:${brand.accent};}`;

  return (
    <>
      <style>{brandVars}</style>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg">
        Lumaktaw sa nilalaman
      </a>
      <SiteHeader siteName={settings.general.site_name} logoUrl={logoUrl} items={header} cta={settings.general.header_cta} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter settings={settings} logoUrl={logoUrl} mainLinks={footerMain} legalLinks={footerLegal} categories={categories} />
      <PageViewTracker />
    </>
  );
}
