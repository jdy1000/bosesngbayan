"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Sends one beacon per route change. The server dedupes, filters bots and honours DNT/GPC. */
export function PageViewTracker({ articleId }: { articleId?: string }) {
  const pathname = usePathname();
  useEffect(() => {
    // Article pages render their own tracker carrying the article id.
    if (!articleId && pathname.startsWith("/balita/")) return;
    // The tip line is never tracked, so no visit record sits next to a tip (ADR-024). The track route refuses it too.
    if (pathname === "/mag-ulat" || pathname.startsWith("/mag-ulat/")) return;
    const body = JSON.stringify({ path: pathname, articleId: articleId ?? null, referrer: document.referrer.slice(0, 1000) });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/public/v1/track", blob)) {
      fetch("/api/public/v1/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  }, [pathname, articleId]);
  return null;
}
