"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Studio error boundary. Without it a failed Studio page fell through to the public site's Filipino
 * error screen, outside the shell. The details stay in the server log; the digest lets staff quote it.
 */
export default function StudioError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The server already logged the cause; this keeps the client-side trace for whoever has the console open.
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-[520px] rounded-[10px] border border-line bg-paper px-[22px] py-11 text-center shadow-panel">
      <h1 className="text-lg font-semibold text-ink">We couldn’t load this page</h1>
      <p className="mx-auto mt-[7px] max-w-[450px] text-[15px] leading-[1.55] text-muted">Your request could not be completed. Retry, or sign in again if your session has expired.</p>
      {error.digest && <p className="mt-3 text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/admin/login" className="btn btn-outline">
          Return to sign in
        </Link>
      </div>
    </div>
  );
}
