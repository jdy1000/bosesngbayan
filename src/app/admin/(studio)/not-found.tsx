import Link from "next/link";

/**
 * Shown inside the Studio shell when a Studio page calls notFound(): a deleted article, a mistyped id.
 * Without it the bare framework 404 appeared, with no menu to get back.
 */
export default function StudioNotFound() {
  return (
    <div className="mx-auto max-w-[520px] rounded-[10px] border border-line bg-paper px-[22px] py-11 text-center shadow-panel">
      <h1 className="text-lg font-semibold text-ink">Page not found</h1>
      <p className="mx-auto mt-[7px] max-w-[450px] text-[15px] leading-[1.55] text-muted">It may have been deleted, or the link is out of date.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/dashboard" className="btn btn-primary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
