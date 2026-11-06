"use client";

export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-site flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <h1 className="font-serif text-3xl font-bold text-navy">May nangyaring error.</h1>
      <p className="mt-3 max-w-md text-ink-soft">Hindi namin ma-load ang pahinang ito ngayon. Subukang muli.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">
        Subukang muli
      </button>
    </div>
  );
}
