import { AdSlot } from "@/components/public/ad-slot";
import { RenderBlocks } from "@/components/public/blocks/render-blocks";
import { EmptyState } from "@/components/public/article-card";
import { getHomepage } from "@/lib/cms/homepage";
import { getSiteSettings } from "@/lib/cms/site";
import { getI18n } from "@/lib/i18n/server";
import { localizeSettings } from "@/lib/settings/schema";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata() {
  return buildMetadata({ path: "/" });
}

export default async function HomePage() {
  const { locale, t } = await getI18n();
  const [homepage, settings] = await Promise.all([getHomepage("published", undefined, locale), getSiteSettings()]);
  const { site_name, tagline } = localizeSettings(settings, locale).general;
  // The news layout has no visible page title (the masthead is the logo), so the h1 is for screen readers and search.
  const title = <h1 className="sr-only">{tagline ? `${site_name}: ${tagline}` : site_name}</h1>;
  if (!homepage || homepage.blocks.length === 0) {
    return (
      <div className="container-site py-20">
        {title}
        <EmptyState title={t.common.home.emptyTitle}>{t.common.home.emptyBody}</EmptyState>
      </div>
    );
  }
  // A hero block carries its own visible h1; only add the hidden one when it is absent.
  const hasHero = homepage.blocks.some((b) => b.type === "hero");
  // News first: the ad goes below the lead stories, or after the first block when there are none.
  const adAfter = homepage.blocks.findIndex((b) => b.type === "top_stories") + 1 || 1;
  return (
    <>
      {!hasHero && title}
      <RenderBlocks blocks={homepage.blocks.slice(0, adAfter)} />
      <AdSlot placement="home" className="container-site py-6" />
      <RenderBlocks blocks={homepage.blocks.slice(adAfter)} />
    </>
  );
}
