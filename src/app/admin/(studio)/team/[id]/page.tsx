import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireStaffPage } from "@/lib/auth/session";
import { ROLE_LABELS, type AppRole } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Empty, Field, PageHeader, Panel, StatusBadge } from "@/components/studio/ui";
import { updateMemberProfile } from "../actions";

export const metadata: Metadata = { title: "Staff profile" };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const isSelf = id === ctx.userId;
  if (!isSelf && !ctx.permissions.has("users.view")) redirect("/admin?denied=1");
  const canEdit = isSelf || ctx.permissions.has("users.manage");
  const canAudit = ctx.permissions.has("audit.view");

  const [profileRes, roleRes, activityRes, auditRes] = await Promise.all([
    ctx.supabase.from("profiles").select("id, display_name, title, bio, is_active, deactivated_at, created_at").eq("id", id).maybeSingle(),
    ctx.supabase.from("user_roles").select("role, assigned_at").eq("user_id", id).maybeSingle(),
    ctx.supabase
      .from("content_activity_logs")
      .select("id, created_at, entity_type, entity_id, action, from_status, to_status")
      .eq("actor_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    canAudit
      ? ctx.supabase.from("audit_logs").select("id, created_at, action, entity_type, entity_id").eq("actor_id", id).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [profileRes, roleRes, activityRes, auditRes]) if (r.error) throw r.error;
  const profile = profileRes.data;
  if (!profile) notFound();
  const activity = activityRes.data ?? [];
  const articleIds = [...new Set(activity.filter((a) => a.entity_type === "article").map((a) => a.entity_id))];
  const titles = new Map<string, string>();
  if (articleIds.length > 0) {
    const { data, error } = await ctx.supabase.from("articles").select("id, title").in("id", articleIds);
    if (error) throw error;
    for (const a of data ?? []) titles.set(a.id, a.title);
  }

  return (
    <>
      <PageHeader
        title={profile.display_name}
        breadcrumb={ctx.permissions.has("users.view") ? [{ label: "Team and Roles", href: "/admin/team" }] : undefined}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {roleRes.data && <Badge tone="blue">{ROLE_LABELS[roleRes.data.role as AppRole]}</Badge>}
            {profile.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated {profile.deactivated_at && formatDateTime(profile.deactivated_at)}</Badge>}
            <span className="text-sm text-muted">Account since {formatDateTime(profile.created_at)}</span>
          </span>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Profile" description="The name, title and bio appear in the byline of published articles.">
          {canEdit ? (
            <ActionForm action={updateMemberProfile}>
              <input type="hidden" name="id" value={profile.id} />
              <div className="space-y-4">
                <Field label="Name" htmlFor="p-name">
                  <input id="p-name" name="display_name" required maxLength={120} defaultValue={profile.display_name} className="field" />
                </Field>
                <Field label="Title" htmlFor="p-title" hint="E.g. Senior Reporter">
                  <input id="p-title" name="title" maxLength={120} defaultValue={profile.title ?? ""} className="field" />
                </Field>
                <Field label="Bio" htmlFor="p-bio">
                  <textarea id="p-bio" name="bio" maxLength={2000} rows={5} defaultValue={profile.bio ?? ""} className="field" />
                </Field>
              </div>
              <div className="mt-4">
                <SubmitButton>Save profile</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-ink">Title</dt>
                <dd className="text-ink-soft">{profile.title || "—"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Bio</dt>
                <dd className="whitespace-pre-line text-ink-soft">{profile.bio || "—"}</dd>
              </div>
            </dl>
          )}
        </Panel>

        <Panel title="Editorial activity" description="The last 20 status changes made by this staff member.">
          {activity.length === 0 ? (
            <Empty title="No editorial activity yet." />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-40 shrink-0 text-xs text-muted">{formatDateTime(a.created_at)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {a.entity_type === "article" && titles.has(a.entity_id) ? (
                      <Link href={`/admin/articles/${a.entity_id}`} className="hover:text-brand">
                        {titles.get(a.entity_id)}
                      </Link>
                    ) : (
                      <span className="text-muted">{a.entity_type} · {a.action}</span>
                    )}
                  </span>
                  {a.to_status && <StatusBadge status={a.to_status} />}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {canAudit && (
          <Panel title="Audit trail" description="The last 20 sensitive actions by this staff member." className="xl:col-span-2">
            {(auditRes.data ?? []).length === 0 ? (
              <Empty title="No audit log entries." />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {(auditRes.data ?? []).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="w-40 shrink-0 text-xs text-muted">{formatDateTime(a.created_at)}</span>
                    <span className="font-mono text-xs">{a.action}</span>
                    <span className="font-mono text-xs text-muted">{a.entity_type}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/admin/audit?actor=${profile.id}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
              Full audit log for this staff member →
            </Link>
          </Panel>
        )}
      </div>
    </>
  );
}
