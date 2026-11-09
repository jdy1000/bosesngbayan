import Image from "next/image";
import { getLiveAd } from "@/lib/cms/ads";
import { getI18n } from "@/lib/i18n/server";

/** One live direct-sold ad for the placement, clearly labelled; renders nothing when none is live. */
export async function AdSlot({ placement, className = "" }: { placement: "home" | "article"; className?: string }) {
  const [ad, { t }] = await Promise.all([getLiveAd(placement), getI18n()]);
  if (!ad) return null;
  return (
    <aside aria-label={t.common.advertisement} className={className}>
      <p className="mb-1.5 text-center text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted">{t.common.advertisement}</p>
      <a href={ad.href} target="_blank" rel="sponsored noopener noreferrer" className="mx-auto block w-fit max-w-full">
        {/* unoptimized: creatives may be external https URLs outside images.remotePatterns, or animated. */}
        <Image src={ad.src} alt={ad.alt} width={ad.width ?? 970} height={ad.height ?? 250} unoptimized className="h-auto max-w-full rounded-sm" />
      </a>
    </aside>
  );
}
