import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CommentSection } from "@/components/public/comment-section";
import { ReportButton } from "@/components/public/report-button";
import { ShareButtons } from "@/components/public/share-buttons";
import { COMMUNITY_KIND_LABELS, getApprovedPost, listApprovedComments } from "@/lib/cms/community";
import { getSiteSettings } from "@/lib/cms/site";
import { siteUrl } from "@/lib/env";
import { formatDateTime, timeAgo, truncate } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  return z.uuid().safeParse(id).success ? getApprovedPost(id) : null;
}

export async function generateMetadata({ params }: Props) {
  const post = await load((await params).id);
  if (!post) return {};
  return buildMetadata({ title: post.title, description: truncate(post.body, 160), path: `/usap-bayan/${post.id}` });
}

export default async function CommunityPostPage({ params }: Props) {
  const post = await load((await params).id);
  if (!post) notFound();
  const [comments, settings] = await Promise.all([listApprovedComments({ postId: post.id }), getSiteSettings()]);
  const open = post.allow_comments && settings.publication.comments_enabled;

  return (
    <div className="container-site max-w-3xl py-10 md:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted">
        <Link href="/usap-bayan" className="hover:text-brand">
          ← Usap Bayan
        </Link>
      </nav>
      <p className="text-xs font-bold uppercase tracking-wider text-accent">
        {COMMUNITY_KIND_LABELS[post.kind]}
        {post.category ? ` · ${post.category.name}` : ""}
      </p>
      <h1 className="mt-2 text-4xl font-semibold leading-tight text-ink">{post.title}</h1>
      <p className="mt-3 text-sm text-muted">
        Ibinahagi ni <strong className="font-semibold text-ink-soft">{post.author_name}</strong>
        {post.author_location ? ` mula sa ${post.author_location}` : ""}
        {post.published_at && (
          <>
            {" · "}
            <time dateTime={post.published_at}>{formatDateTime(post.published_at)}</time>
          </>
        )}
      </p>
      <div className="mt-6 whitespace-pre-line text-lg leading-relaxed text-ink">{post.body}</div>
      <p className="mt-6 rounded-xl bg-surface px-4 py-3 text-sm text-ink-soft">
        Ang pananaw na ito ay mula sa isang miyembro ng komunidad at hindi kumakatawan sa posisyon ng Boses ng Bayan.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <ShareButtons url={siteUrl(`/usap-bayan/${post.id}`)} title={post.title} />
        <ReportButton postId={post.id} />
      </div>
      {post.allow_comments && (
        <CommentSection target={{ postId: post.id }} isOpen={open} comments={comments.map((c) => ({ ...c, created_label: timeAgo(c.created_at) }))} />
      )}
    </div>
  );
}
