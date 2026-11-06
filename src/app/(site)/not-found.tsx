import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="container-site flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-accent">404</p>
      <h1 className="mt-3 text-4xl font-semibold text-ink md:text-5xl">{t.common.notFound.title}</h1>
      <p className="mt-3 max-w-md text-lg text-ink-soft">{t.common.notFound.body}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          {t.common.notFound.home}
        </Link>
        <Link href="/hanap" className="btn btn-outline">
          {t.common.notFound.search}
        </Link>
      </div>
    </div>
  );
}
