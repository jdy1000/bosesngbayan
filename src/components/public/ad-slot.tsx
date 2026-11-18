import Image from "next/image";
import { AD_FALLBACK_SIZE, type AdPlacement } from "@/lib/ad-placements";
import { getLiveAd } from "@/lib/cms/ads";
import { getI18n } from "@/lib/i18n/server";

/**
 * One live direct-sold ad for the placement, labelled the way news sites do it ("Advertisement" above the unit; "Story
 * continues below advertisement" inside a story); renders nothing, and takes no space, when none is live.
 * `top` is a full-width band under the header; the others are placed by the caller through `className`.
 */
export async function AdSlot({ placement, className = "" }: { placement: AdPlacement; className?: string }) {
  const [ad, { t }] = await Promise.all([getLiveAd(placement), getI18n()]);
  if (!ad) return null;
  const size = AD_FALLBACK_SIZE[placement];
  const label = placement === "article_inline" ? t.common.storyContinuesBelowAd : t.common.advertisement;
  const unit = (
    <aside aria-label={t.common.advertisement} className={placement === "top" ? "" : className}>
      <p className="mb-1.5 text-center text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <a href={ad.href} target="_blank" rel="sponsored noopener noreferrer" className="mx-auto block w-fit max-w-full">
        {/* unoptimized: creatives may be external https URLs outside images.remotePatterns, or animated. */}
        <Image src={ad.src} alt={ad.alt} width={ad.width ?? size.width} height={ad.height ?? size.height} unoptimized className="h-auto max-w-full rounded-sm" />
      </a>
    </aside>
  );
  if (placement !== "top") return unit;
  return (
    <div className={`border-b border-line bg-surface ${className}`}>
      <div className="container-site py-3">{unit}</div>
    </div>
  );
}
