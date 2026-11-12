/** Shown inside the Studio shell while a page's data loads. */
export default function StudioLoading() {
  return (
    <p role="status" aria-live="polite" className="px-[22px] py-11 text-center text-[15px] text-muted">
      Loading your workspace…
    </p>
  );
}
