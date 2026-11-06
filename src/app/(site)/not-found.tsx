import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-site flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-accent">404</p>
      <h1 className="mt-3 font-serif text-4xl font-bold text-navy md:text-5xl">Hindi nahanap ang pahina.</h1>
      <p className="mt-3 max-w-md text-lg text-ink-soft">Maaaring inilipat, inalis, o mali ang link.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Bumalik sa Bahay
        </Link>
        <Link href="/hanap" className="btn btn-outline">
          Maghanap ng balita
        </Link>
      </div>
    </div>
  );
}
