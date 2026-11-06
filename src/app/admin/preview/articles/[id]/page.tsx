import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { ArticleView } from "@/components/public/article-view";
import { getPublicArticlesByIds } from "@/lib/cms/articles";
import { getArticlePreview } from "@/lib/studio/articles";
import { ARTICLE_STATUS } from "@/components/studio/ui";

// Protected preview: session-authorized, never cached, never indexed. Lives outside /balita so no
// public route or cache can serve draft content.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

export default async function ArticlePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const preview = await getArticlePreview(ctx, id);
  if (!preview) notFound();
  const related = await getPublicArticlesByIds(preview.detail.related_ids.slice(0, 3));
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

  return (
    <main>
      <ArticleView
        article={preview.detail}
        related={related}
        shareUrl={`${site}/balita/${preview.detail.slug}`}
        banner={
          <div role="note" className="sticky top-0 z-30 flex flex-wrap items-center gap-3 bg-amber-400 px-4 py-2 text-sm font-bold text-navy">
            PREVIEW — hindi pa nakalathala
            <span className="font-semibold">Status: {ARTICLE_STATUS[preview.status]?.label ?? preview.status}</span>
            <Link href={`/admin/articles/${id}`} className="ml-auto underline">
              Bumalik sa editor
            </Link>
          </div>
        }
      />
    </main>
  );
}
