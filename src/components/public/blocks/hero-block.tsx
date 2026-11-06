import Image from "next/image";
import Link from "next/link";
import { PollWidget } from "@/components/public/poll-widget";
import type { BlockSettings } from "@/lib/homepage/blocks";
import { getFeaturedPoll, getPublicPollById } from "@/lib/cms/polls";
import { getMediaById, getTotalBallots } from "@/lib/cms/site";
import { formatNumber } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

/** Splits the headline so the configured highlight word renders in brand blue, as in the reference. */
function Headline({ text, highlight }: { text: string; highlight: string }) {
  const idx = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase()) : -1;
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-brand">{text.slice(idx, idx + highlight.length)}</span>
      {text.slice(idx + highlight.length)}
    </>
  );
}

export async function HeroBlock({ settings }: { settings: BlockSettings<"hero"> }) {
  const [image, poll, ballots] = await Promise.all([
    getMediaById(settings.image_id),
    settings.poll_id ? getPublicPollById(settings.poll_id) : getFeaturedPoll(),
    settings.show_participation_count ? getTotalBallots() : Promise.resolve(0),
  ]);
  const src = mediaUrl(image);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <div className="container-site grid items-center gap-10 py-10 md:py-14 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:py-16">
        <div className="max-w-xl">
          {settings.eyebrow && (
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-accent shadow-[inset_0_0_0_1px_var(--color-line)]">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              {settings.eyebrow}
            </p>
          )}
          <h1 className="text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.015em] text-ink sm:text-[3.4rem] lg:text-[4rem]">
            <Headline text={settings.headline} highlight={settings.highlight} />
          </h1>
          {settings.description && <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft md:text-xl">{settings.description}</p>}
          {(settings.primary_cta || settings.secondary_cta) && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {settings.primary_cta && (
                <Link href={settings.primary_cta.href} className="btn btn-primary h-13 px-7 text-base">
                  {settings.primary_cta.label}
                </Link>
              )}
              {settings.secondary_cta && (
                <Link href={settings.secondary_cta.href} className="btn btn-outline h-13 px-7 text-base">
                  {settings.secondary_cta.label}
                </Link>
              )}
            </div>
          )}
          {settings.show_participation_count && ballots > 0 && (
            <p className="mt-8 text-[0.95rem] text-ink-soft">
              <strong className="text-2xl font-semibold text-ink tabular-nums">{formatNumber(ballots)}</strong>{" "}
              {settings.participation_label || "boto na ang naitala"}
            </p>
          )}
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-gradient-to-br from-brand to-navy shadow-[var(--shadow-float)] sm:aspect-[16/11] lg:aspect-[5/4.4]">
            {src ? (
              <Image
                src={src}
                alt={image?.alt_text ?? ""}
                fill
                priority
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-start p-8" aria-hidden="true">
                <span className="text-5xl font-semibold leading-none text-white/15">Boses ng Bayan</span>
              </div>
            )}
            {image?.credit && (
              <span className="absolute bottom-2 left-3 rounded bg-black/45 px-2 py-0.5 text-[0.7rem] text-white/90">{image.credit}</span>
            )}
          </div>
          {poll && (
            <div className="relative z-10 mx-3 -mt-24 sm:mx-auto sm:max-w-md lg:absolute lg:-bottom-6 lg:-left-10 lg:mx-0 lg:mt-0 lg:w-[22rem]">
              <PollWidget poll={poll} variant="hero" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
