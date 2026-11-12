import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/session";
import { COMMUNITY_KIND_LABELS } from "@/lib/cms/community";
import { formatDateTime } from "@/lib/format";
import { Badge, PageHeader, Panel, StatusBadge } from "@/components/studio/ui";
import { MODERATION_STATUS } from "../../labels";
import { ActivityHistory, DetailRow, ModerationPanel, ReportsPanel } from "../../parts";

export const metadata = { title: "Community post" };

export default async function ModerationPostPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage("moderation.manage");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [{ data: post }, { data: reports }, { count: commentCount }] = await Promise.all([
    ctx.supabase
      .from("community_posts")
      .select(
        "id, kind, title, body, author_name, author_email, author_location, status, is_featured, allow_comments, staff_author_id, moderator_note, moderated_at, published_at, created_at, category:categories(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    ctx.supabase
      .from("moderation_reports")
      .select("id, reason, details, status, resolution_note, resolved_at, created_at")
      .eq("community_post_id", id)
      .order("created_at", { ascending: false }),
    ctx.supabase.from("comments").select("id", { count: "exact", head: true }).eq("community_post_id", id),
  ]);
  if (!post) notFound();

  return (
    <>
      <PageHeader
        title={post.title}
        breadcrumb={[{ label: "Report inbox", href: "/admin/moderation?tab=posts" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={post.status} map={MODERATION_STATUS} />
            <Badge tone="blue">{COMMUNITY_KIND_LABELS.en[post.kind]}</Badge>
            {post.is_featured && <Badge tone="navy">Featured</Badge>}
            {post.staff_author_id && <Badge>Staff post</Badge>}
          </span>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel title="Full content">
            <p className="whitespace-pre-line break-words text-[15px] leading-[1.55] text-ink">{post.body}</p>
          </Panel>
          <ReportsPanel reports={reports ?? []} />
          <ActivityHistory ctx={ctx} entityType="community_post" entityId={post.id} reportIds={(reports ?? []).map((r) => r.id)} />
        </div>
        <aside className="space-y-6">
          <ModerationPanel targetType="community_post" targetId={post.id} status={post.status} isFeatured={post.is_featured} currentNote={post.moderator_note} />
          <Panel title="Details">
            <dl className="space-y-3.5">
              <DetailRow label="Author">{post.author_name}</DetailRow>
              <DetailRow label="Email (staff only)">{post.author_email ?? "Not provided"}</DetailRow>
              <DetailRow label="Location">{post.author_location ?? "—"}</DetailRow>
              <DetailRow label="Category">{post.category?.name ?? "—"}</DetailRow>
              <DetailRow label="Submitted">{formatDateTime(post.created_at)}</DetailRow>
              {post.published_at && <DetailRow label="Published">{formatDateTime(post.published_at)}</DetailRow>}
              {post.moderated_at && <DetailRow label="Last moderated">{formatDateTime(post.moderated_at)}</DetailRow>}
              <DetailRow label="Comments">{post.allow_comments ? `Open (${commentCount ?? 0})` : "Closed"}</DetailRow>
            </dl>
            {(commentCount ?? 0) > 0 && (
              <Link href={`/admin/moderation?tab=comments&status=all&post=${post.id}`} className="btn btn-outline mt-5 min-h-9 px-3 text-[13px]">
                View comments
              </Link>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
