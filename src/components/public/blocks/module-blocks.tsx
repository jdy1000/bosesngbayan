import Image from "next/image";
import Link from "next/link";
import { NewsQuiz } from "@/components/public/news-quiz";
import { SectionHeading } from "@/components/public/article-card";
import type { BlockSettings } from "@/lib/homepage/blocks";
import { getMediaById } from "@/lib/cms/site";
import { mediaUrl } from "@/lib/media";

export async function PhotoOfDayBlock({ title, settings }: { title: string | null; settings: BlockSettings<"photo_of_day"> }) {
  const media = await getMediaById(settings.media_id);
  const src = mediaUrl(media);
  if (!src) return null;
  const caption = settings.caption || media?.caption;
  return (
    <section className="py-14 md:py-18">
      <div className="container-site">
        <SectionHeading title={title ?? "Larawan ng Araw"} />
        <figure>
          <div className="relative aspect-[21/9] overflow-hidden rounded-[22px] bg-surface-2">
            <Image src={src} alt={media?.alt_text ?? ""} fill sizes="(min-width: 1200px) 1136px, 100vw" className="object-cover" />
          </div>
          <figcaption className="mt-3 flex flex-col gap-1 text-[0.95rem] text-ink-soft sm:flex-row sm:justify-between">
            <span>
              {caption}
              {settings.link && (
                <>
                  {" "}
                  <Link href={settings.link.href} className="font-semibold text-brand hover:underline">
                    {settings.link.label}
                  </Link>
                </>
              )}
            </span>
            {media?.credit && <span className="text-sm text-muted">Larawan: {media.credit}</span>}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export function QuoteOfDayBlock({ title, settings }: { title: string | null; settings: BlockSettings<"quote_of_day"> }) {
  return (
    <section className="bg-navy py-14 text-white md:py-18">
      <div className="container-site max-w-4xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">{title ?? "Sipi ng Araw"}</p>
        <blockquote className="mt-5">
          <p className="font-serif text-3xl font-semibold leading-snug md:text-[2.5rem]">“{settings.quote}”</p>
          <footer className="mt-6 text-base text-white/80">
            — <cite className="not-italic font-semibold text-white">{settings.attribution}</cite>
            {settings.context && <span>, {settings.context}</span>}
            {settings.source_url && (
              <>
                {" · "}
                <a href={settings.source_url} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                  Pinagmulan
                </a>
              </>
            )}
          </footer>
        </blockquote>
      </div>
    </section>
  );
}

export function NewsQuizBlock({ title, settings }: { title: string | null; settings: BlockSettings<"news_quiz"> }) {
  if (settings.questions.length === 0) return null;
  return (
    <section className="bg-surface py-14 md:py-18">
      <div className="container-site max-w-3xl">
        <SectionHeading title={title ?? "News Quiz"} description={settings.intro || null} />
        <NewsQuiz questions={settings.questions} />
      </div>
    </section>
  );
}
