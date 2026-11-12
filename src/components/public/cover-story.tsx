import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ArticleCard as Article } from "@/lib/cms/articles";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { mediaUrl } from "@/lib/media";
import { displayFont } from "./display-font";

/**
 * The homepage lead as a cover story (owner reference, 2026-11-09): full-bleed photo, dark scrim, spaced kicker,
 * serif headline, a two-line deck and an underlined "Read the story" with the reading time.
 * Text is white over the scrim in both themes; the card has no light/dark variant of its own.
 * Layout classes (grid placement, height) come from the caller; the whole card is one link.
 */
export async function CoverStory({ article, priority, className = "" }: { article: Article; priority?: boolean; className?: string }) {
  const { t } = await getI18n();
  const c = t.common.card;
  const src = mediaUrl(article.image);

  return (
    // lg: 26rem. The row is shared with the rail's top card, whose photo stretches to end on the same line.
    <article className={`group relative isolate flex min-h-[30rem] overflow-hidden rounded-md bg-navy text-white sm:min-h-[34rem] lg:min-h-[26rem] ${className}`}>
      {src && (
        <Image
          src={src}
          alt={article.image?.alt_text ?? ""}
          fill
          sizes="(min-width: 1024px) 780px, 100vw"
          preload={priority}
          fetchPriority={priority ? "high" : undefined}
          className="-z-20 object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
        />
      )}
      {/* Scrim: darkest under the text, clear at the top so the photograph still reads. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(0_0_0/0.9)_0%,rgb(0_0_0/0.74)_45%,rgb(0_0_0/0.3)_72%,rgb(0_0_0/0)_100%)]"
      />
      <Link
        href={`/balita/${article.slug}`}
        className="flex w-full flex-col justify-end gap-3 p-6 focus-visible:outline-white focus-visible:outline-offset-[-6px] sm:gap-4 sm:p-8 lg:gap-3.5 lg:p-8"
      >
        {/* Phones show only the category: "cover story / category" does not fit on one line at 390px. */}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white [text-shadow:0_1px_10px_rgb(0_0_0/0.5)]">
          {article.is_breaking && <span className="rounded-[3px] bg-accent px-2 py-0.5 tracking-[0.1em] [text-shadow:none]">{c.breaking}</span>}
          <span className={article.category ? "hidden sm:inline" : ""}>{c.coverStory}</span>
          {article.category && (
            <>
              <span aria-hidden="true" className="hidden text-white/50 sm:inline">/</span>
              <span>{article.category.name}</span>
            </>
          )}
        </p>
        <h2 className={`${displayFont.className} max-w-[40rem] text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.01em] text-white sm:text-[2.35rem] lg:max-w-[42rem] lg:text-[2.2rem]`}>
          {article.title}
        </h2>
        {/* The deck is dropped at lg, where the card is only as tall as the rail's top card. */}
        {article.excerpt && <p className="line-clamp-2 max-w-[36rem] text-[1.0625rem] leading-relaxed text-white/90 lg:hidden">{article.excerpt}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm sm:mt-2 lg:mt-1">
          <span className="inline-flex items-center gap-2 border-b border-white/70 pb-1.5 font-semibold transition-colors duration-150 group-hover:border-white">
            {c.readStory}
            <ArrowUpRight
              className="h-4 w-4 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
          {article.reading_minutes > 0 && <span className="text-white/80">{fmt(c.readingMinutes, { n: article.reading_minutes })}</span>}
        </div>
      </Link>
    </article>
  );
}
