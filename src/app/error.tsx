"use client";

/** Catches failures in route-group layouts (e.g. the CMS is unreachable while loading site settings). */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container-site flex min-h-screen flex-col items-center justify-center py-20 text-center">
      <p className="font-serif text-2xl font-bold text-brand">Boses ng Bayan</p>
      <h1 className="mt-6 font-serif text-3xl font-bold text-navy">Pansamantalang hindi available ang site.</h1>
      <p className="mt-3 max-w-md text-ink-soft">May problema sa pagkonekta sa aming server. Subukang muli maya-maya.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">
        Subukang muli
      </button>
    </main>
  );
}
