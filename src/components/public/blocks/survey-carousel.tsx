"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PublicSurvey, PublicSurveyEntry } from "@/lib/cms/surveys";
import { photoStyle } from "@/lib/survey-photo";

export interface SurveyLabels {
  overall: string;
  trust: string;
  performance: string;
  rank: string;
  prev: string;
  next: string;
  picker: string;
  scroll: string;
}

/** A survey plus its release date already formatted for the reader's language (done on the server). */
export type CarouselSurvey = PublicSurvey & { dateLabel: string };

/** How fast the row drifts on its own, in pixels per second (about one card every five seconds). */
const DRIFT_PX_PER_SECOND = 55;
/** The drift carries on this long after the last touch, swipe, button press, wheel turn or key press (and after the row stops coasting). */
const RESUME_AFTER_MS = 2000;
/** One group of cards must be wider than any screen, or the loop would show a gap at the end. */
const MIN_CARDS_PER_GROUP = 8;
/** Groups in the loop: the reader sits in the middle ones and is moved back by one group whenever they near an end. */
const LOOP_GROUPS = 4;

const pct = (n: number | null) => (n === null ? null : `${n.toFixed(1)}%`);

const subscribeReducedMotion = (notify: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const reducedMotionNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Name and place stay on one line each (the card is wide enough for the longest); an ellipsis is only the safety net. */
const oneLine = "overflow-hidden text-ellipsis whitespace-nowrap";

function Card({ entry, labels, hidden }: { entry: PublicSurveyEntry; labels: SurveyLabels; hidden: boolean }) {
  const overall = pct(entry.overall);
  const trust = pct(entry.trust);
  const performance = pct(entry.performance);
  return (
    <li {...(hidden ? { "aria-hidden": true, inert: true } : {})} className="w-[min(15.5rem,78vw)] shrink-0 sm:w-[16rem]">
      <article className="h-full overflow-hidden rounded-md bg-paper shadow-[0_0_0_1px_var(--color-line),0_6px_18px_-12px_rgb(18_20_24/0.35)]">
        {/* Square frame: it scales with the card (itself fluid on phones), and the photo is placed by the editor (x, y, zoom). */}
        <div className="img-frame relative aspect-square overflow-hidden bg-surface-2">
          {entry.photo ? (
            <Image
              src={entry.photo.src}
              alt={hidden ? "" : entry.photo.alt}
              fill
              sizes="(min-width: 640px) 256px, min(248px, 78vw)"
              className="object-cover"
              style={photoStyle(entry.photo)}
              draggable={false}
            />
          ) : (
            <span aria-hidden="true" className="absolute inset-0 grid place-items-center text-5xl font-semibold text-brand/25">
              {entry.name.charAt(0)}
            </span>
          )}
          {entry.rank !== null && (
            <span className="absolute right-2 top-2 grid h-7 min-w-7 place-items-center rounded-[4px] bg-accent px-1.5 text-sm font-extrabold leading-none text-white tabular-nums shadow-[0_2px_6px_rgb(0_0_0/0.25)]">
              <span className="sr-only">{labels.rank} </span>
              {entry.rank}
            </span>
          )}
          {overall && (
            <span className="absolute bottom-2 left-2 rounded-[4px] bg-navy px-2 py-1 text-white shadow-[0_2px_6px_rgb(0_0_0/0.25)]">
              <span className="sr-only">{labels.overall}: </span>
              <span className="text-lg font-extrabold leading-none tracking-[-0.01em] tabular-nums">{overall}</span>
            </span>
          )}
        </div>
        <div className="p-3">
          <h3 title={entry.name} className={`${oneLine} text-[0.95rem] font-bold leading-tight text-ink`}>
            {entry.name}
          </h3>
          {entry.area && (
            <p title={entry.area} className={`${oneLine} mt-0.5 text-[0.72rem] font-bold uppercase tracking-[0.04em] text-brand`}>
              {entry.area}
            </p>
          )}
          {(trust || performance) && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 border-t border-line pt-2 text-[0.78rem] text-ink-soft">
              {trust && (
                <>
                  <dt>{labels.trust}</dt>
                  <dd className="text-right font-semibold text-ink tabular-nums">{trust}</dd>
                </>
              )}
              {performance && (
                <>
                  <dt>{labels.performance}</dt>
                  <dd className="text-right font-semibold text-ink tabular-nums">{performance}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      </article>
    </li>
  );
}

const arrowButton =
  "inline-flex size-11 items-center justify-center rounded-full bg-paper text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-brand-50 hover:text-brand active:scale-[0.96]";

/**
 * Homepage Surveys band: heading + date, optional survey tabs (only when more than one survey is published), and a
 * row of candidate cards. The row is an ordinary horizontally scrolling strip, so a finger swipe, the wheel, a trackpad
 * and the arrow keys all work; the ‹ › buttons move it by whole cards. On top of that it drifts slowly and loops, and
 * the drift waits while the pointer is over it, while it has focus, while a finger is on it and until 2 seconds after
 * the last manual move has finished (a swipe's coasting included). With "reduce motion" it does not drift at all and is a single, plain row.
 */
export function SurveyCarousel({
  title,
  asOf,
  surveys,
  labels,
}: {
  title: string;
  /** "Released {date}" template, filled in per survey. */
  asOf: string;
  surveys: CarouselSurvey[];
  labels: SurveyLabels;
}) {
  const [active, setActive] = useState(0);
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);
  const scroller = useRef<HTMLDivElement>(null);
  const pauseUntil = useRef(0);
  const survey = surveys[Math.min(active, surveys.length - 1)]!;

  const loop = !reduced;
  const groups = loop ? LOOP_GROUPS : 1;
  // A short survey is repeated inside each group until the group is wider than the screen.
  const repeats = Math.ceil(MIN_CARDS_PER_GROUP / survey.entries.length);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const group = () => el.scrollWidth / groups;
    if (loop) el.scrollLeft = group(); // start in the second group: it looks exactly like the first, with room to go back

    let frame = 0;
    let last = 0;
    let carry = 0;
    let onScreen = true;
    let hovering = false;
    let focused = false;
    let pressed = false;
    // Where the row is after our own last write. A scroll event that lands anywhere else was the reader (a swipe, its
    // coasting, a smooth scroll from the buttons), so it restarts the 2 second wait instead of being mistaken for drift.
    let expected = el.scrollLeft;
    const hold = () => {
      pauseUntil.current = Date.now() + RESUME_AFTER_MS;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = last ? Math.min(now - last, 64) : 0;
      last = now;
      if (!loop || !onScreen || document.hidden || hovering || focused || pressed || Date.now() < pauseUntil.current) return;
      // Browsers round scrollLeft, so whole pixels are applied and the remainder is carried to the next frame.
      carry += (DRIFT_PX_PER_SECOND * dt) / 1000;
      const whole = Math.trunc(carry);
      if (whole > 0) {
        el.scrollLeft += whole;
        expected = el.scrollLeft;
        carry -= whole;
      }
    };

    const onScroll = () => {
      if (!loop) return;
      const g = group();
      const reader = Math.abs(el.scrollLeft - expected) > 1;
      if (reader) hold();
      if (el.scrollLeft < g * 0.5) el.scrollLeft += g;
      else if (el.scrollLeft > g * 2.5) el.scrollLeft -= g;
      expected = el.scrollLeft;
    };
    const onPress = () => {
      pressed = true;
      hold();
    };
    const onRelease = () => {
      pressed = false;
      hold();
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hovering = true;
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hovering = false;
    };
    const onFocusIn = () => (focused = true);
    const onFocusOut = () => (focused = false);
    const observer = new IntersectionObserver(([entry]) => (onScreen = entry?.isIntersecting ?? true));
    observer.observe(el);

    const touching = ["touchstart", "touchmove", "touchend", "wheel", "keydown"];
    el.addEventListener("pointerdown", onPress);
    el.addEventListener("pointerup", onRelease);
    el.addEventListener("pointercancel", onRelease);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    for (const type of touching) el.addEventListener(type, hold, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      el.removeEventListener("pointerdown", onPress);
      el.removeEventListener("pointerup", onRelease);
      el.removeEventListener("pointercancel", onRelease);
      for (const type of touching) el.removeEventListener(type, hold);
    };
  }, [survey.id, loop, groups]);

  /** Move by as many whole cards as fit on screen (at least one), in the direction asked. */
  function nudge(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    pauseUntil.current = Date.now() + RESUME_AFTER_MS;
    const first = el.querySelector("li");
    const second = first?.nextElementSibling as HTMLElement | null;
    const step = first && second ? second.offsetLeft - first.offsetLeft : 272;
    const perPress = Math.max(1, Math.floor(el.clientWidth / step));
    el.scrollBy({ left: direction * perPress * step, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <section aria-label={title} className="overflow-hidden rounded-lg border border-line bg-surface py-6 md:py-8">
      <div className="px-5 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-brand">{title}</p>
            <h2 className="mt-1.5 text-balance text-[1.45rem] font-bold leading-[1.15] tracking-[-0.02em] text-ink md:text-[1.9rem]">
              {survey.title}
              {survey.scope && <span className="text-brand"> ({survey.scope})</span>}
            </h2>
            {survey.subtitle && <p className="mt-1.5 text-pretty text-[0.95rem] text-ink-soft">{survey.subtitle}</p>}
            <p className="mt-1 text-[0.85rem] text-muted">{asOf.replace("{date}", survey.dateLabel)}</p>
          </div>
          {/* Centred under the text on phones, at the right edge of the heading from sm up. */}
          <div className="flex w-full justify-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
            <button type="button" onClick={() => nudge(-1)} className={arrowButton} aria-label={labels.prev}>
              <ChevronLeft className="size-5" strokeWidth={2.25} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => nudge(1)} className={arrowButton} aria-label={labels.next}>
              <ChevronRight className="size-5" strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>
        </div>

        {surveys.length > 1 && (
          <div role="group" aria-label={labels.picker} className="mt-5 flex flex-wrap gap-2">
            {surveys.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${
                  i === active ? "bg-navy text-white" : "bg-paper text-ink-soft shadow-[inset_0_0_0_1px_var(--color-line)] hover:text-ink"
                }`}
              >
                {s.scope ? `${s.title} · ${s.scope}` : s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* key: switching survey starts a fresh row from the first card. */}
      <div key={survey.id} ref={scroller} tabIndex={0} role="region" aria-label={labels.scroll} className="survey-scroller mt-6">
        <div className="flex w-max">
          {Array.from({ length: groups }, (_, g) => (
            <ul key={g} className="flex gap-3 py-1 pr-3 sm:gap-4 sm:pr-4">
              {Array.from({ length: repeats }, (_, r) =>
                survey.entries.map((e) => <Card key={`${r}-${e.id}`} entry={e} labels={labels} hidden={g > 0 || r > 0} />),
              )}
            </ul>
          ))}
        </div>
      </div>

      {survey.note && <p className="mt-4 max-w-3xl px-5 text-pretty text-[0.8rem] leading-relaxed text-muted md:px-8">{survey.note}</p>}
    </section>
  );
}
