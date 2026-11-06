"use client";

/** Catches failures in route-group layouts (e.g. the CMS is unreachable while loading site settings). */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container-site flex min-h-screen flex-col items-center justify-center py-20 text-center">
      <p className="text-2xl font-semibold text-brand">Boses ng Bayan</p>
      <h1 className="mt-6 text-3xl font-semibold text-ink">Pansamantalang hindi available ang site.</h1>
      <p className="mt-3 max-w-md text-ink-soft">May problema sa pagkonekta sa aming server. Subukang muli maya-maya.</p>
      {/* Outside the site layout (no reader language available), so English follows the Filipino. */}
      <p lang="en" className="mt-3 max-w-md text-sm text-muted">The site is temporarily unavailable. Please try again in a moment.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">
        Subukang muli · Try again
      </button>
    </main>
  );
}
