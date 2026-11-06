"use client";

import { useState } from "react";
import { Link2, Share2 } from "lucide-react";
import { useI18n } from "@/components/public/i18n-provider";

/** Share via plain intent URLs (no third-party scripts or trackers), native share sheet, or copy link. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const m = useI18n().t.article.share;
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: "X", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { label: "Viber", href: `viber://forward?text=${t}%20${u}` },
  ];

  // Always rendered (no post-hydration layout shift); falls back to copying where there is no share sheet.
  async function nativeShare() {
    if (!("share" in navigator)) return copy();
    try {
      await navigator.share({ title, url });
    } catch {
      // user cancelled
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const btn = "inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold text-ink-soft shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:text-brand hover:shadow-[inset_0_0_0_1px_var(--color-brand-200)]";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={m.label}>
      <button type="button" onClick={nativeShare} className={btn}>
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> {m.share}
      </button>
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={btn}>
          {l.label}
        </a>
      ))}
      <button type="button" onClick={copy} className={btn} aria-live="polite">
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> {copied ? m.copied : m.copy}
      </button>
    </div>
  );
}
