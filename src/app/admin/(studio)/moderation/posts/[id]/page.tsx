import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/session";
import { COMMUNITY_KIND_LABELS } from "@/lib/cms/community";
import { formatDateTime } from "@/lib/format";
import { Badge, PageHeader, Panel, StatusBadge } from "@/components/studio/ui";
import { MODERATION_STATUS } from "../../labels";
import { ActivityHistory, ModerationPanel, ReportsPanel } from "../../parts";

export const metadata = { title: "Post ng komunidad" };

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
        breadcrumb={[{ label: "Moderation", href: "/admin/moderation?tab=posts" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={post.status} map={MODERATION_STATUS} />
            <Badge tone="blue">{COMMUNITY_KIND_LABELS[post.kind]}</Badge>
            {post.is_featured && <Badge tone="navy">Featured</Badge>}
            {post.staff_author_id && <Badge>Gawa ng staff</Badge>}
          </span>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel title="Buong nilalaman">
            <p className="whitespace-pre-line break-words text-[0.95rem] leading-relaxed text-ink">{post.body}</p>
          </Panel>
          <ReportsPanel reports={reports ?? []} />
          <ActivityHistory ctx={ctx} entityType="community_post" entityId={post.id} reportIds={(reports ?? []).map((r) => r.id)} />
        </div>
        <aside className="space-y-6">
          <ModerationPanel targetType="community_post" targetId={post.id} status={post.status} isFeatured={post.is_featured} currentNote={post.moderator_note} />
          <Panel title="Detalye">
            <dl className="space-y-2 text-sm">
              <Row label="May-akda" value={post.author_name} />
              <Row label="Email (staff lamang)" value={post.author_email ?? "Hindi ibinigay"} />
              <Row label="Lokasyon" value={post.author_location ?? "—"} />
              <Row label="Kategorya" value={post.category?.name ?? "—"} />
              <Row label="Isinumite" value={formatDateTime(post.created_at)} />
              {post.published_at && <Row label="Nailathala" value={formatDateTime(post.published_at)} />}
              {post.moderated_at && <Row label="Huling moderation" value={formatDateTime(post.moderated_at)} />}
              <Row label="Komento" value={post.allow_comments ? `Bukas (${commentCount ?? 0})` : "Sarado"} />
            </dl>
            {(commentCount ?? 0) > 0 && (
              <Link href={`/admin/moderation?tab=comments&status=all&post=${post.id}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
                Tingnan ang mga komento →
              </Link>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="break-words text-ink">{value}</dd>
    </div>
  );
}
