import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { getPageForEdit } from "@/lib/studio/pages";
import { PAGE_STATUS_LABELS } from "@/app/admin/(studio)/pages/status";

// Protected preview: session-authorized (pages.manage), never cached, never indexed.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

export default async function PagePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("pages.manage");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getPageForEdit(ctx, id);
  if (!data) notFound();
  const { page } = data;

  return (
    <main>
      <div role="note" className="sticky top-0 z-30 flex flex-wrap items-center gap-3 bg-amber-400 px-4 py-2 text-sm font-bold text-black">
        PREVIEW — not published yet
        <span className="font-semibold">Status: {PAGE_STATUS_LABELS[page.status].label}</span>
        <Link href={`/admin/pages/${id}`} className="ml-auto underline">
          Back to editor
        </Link>
      </div>
      <article className="container-site max-w-[760px] py-10 md:py-14">
        <h1 className="font-serif text-[2.2rem] font-bold leading-[1.1] text-navy md:text-[3rem]">{page.title}</h1>
        {page.summary && <p className="mt-4 text-xl leading-relaxed text-ink-soft">{page.summary}</p>}
        {/* body_html was sanitized on save (src/lib/rich-text/render.ts). */}
        <div className="prose-bnb mt-8" dangerouslySetInnerHTML={{ __html: page.body_html }} />
      </article>
    </main>
  );
}
