import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { ROLE_LABELS, ROLES, type AppRole } from "@/lib/auth/permissions";
import { assignableRoles, loadPermissionMatrix, loadTeam, type TeamMember } from "@/lib/studio/team";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Empty, Field, Notice, PageHeader, Pagination, Panel, RecordList, RecordMeta, RecordRow, RecordTitle, StatusBadge, Toolbar, ToolbarSearch, ToolbarTabs, withParams, type BadgeTone } from "@/components/studio/ui";
import { changeRole, inviteMember, setMemberActive } from "./actions";
import { PermissionMatrixView } from "./permission-matrix";

export const metadata: Metadata = { title: "Team and Roles" };

const PAGE_SIZE = 8; // as in the Newsmaker console
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
// SubmitButton sets its own size, so the row size needs the important flag.
const SMALL = "!min-h-9 !px-3 !text-[13px]";

const STATUSES = ["active", "invited", "deactivated"] as const;
type AccountStatus = (typeof STATUSES)[number];
const STATUS: Record<AccountStatus, { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "green" },
  invited: { label: "Invited", tone: "amber" },
  deactivated: { label: "Deactivated", tone: "red" },
};

/** Invited = an invitation went out and the account was never confirmed or signed in. Deactivated wins over both. */
function statusOf(m: TeamMember): AccountStatus {
  if (!m.isActive) return "deactivated";
  return !m.confirmedAt && !m.lastSignInAt && m.invitedAt ? "invited" : "active";
}

/**
 * Accounts in the Newsmaker console's shape: an invite disclosure, then one panel with status tabs, search and
 * eight accounts per page. Filtering happens in memory because loadTeam() already returns every staff account.
 */
export default async function TeamPage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireStaffPage("users.view");
  const sp = await searchParams;
  const canManage = ctx.permissions.has("users.manage");
  const [members, matrix] = await Promise.all([loadTeam(ctx), loadPermissionMatrix(ctx)]);
  const roles = assignableRoles(ctx.role);

  const editRole = ROLES.find((r) => r === one(sp.edit) && r !== "owner") ?? null;
  const status = STATUSES.find((s) => s === one(sp.status));
  const q = one(sp.q).trim().slice(0, 120);
  const needle = q.toLowerCase();
  const found = members.filter(
    (m) => (!status || statusOf(m) === status) && (!needle || m.displayName.toLowerCase().includes(needle) || (m.email ?? "").toLowerCase().includes(needle)),
  );
  const totalPages = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));
  const visible = found.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // `edit` keeps the permission editor open while the list is filtered or paged.
  const params = { status, q, edit: editRole ?? undefined };

  return (
    <>
      <PageHeader eyebrow="Access control" title="Accounts and roles" description="Invite newsroom accounts and manage roles and status." />

      {canManage && (
        <details className="mb-6 rounded-[10px] border border-line bg-paper shadow-panel">
          <summary className="cursor-pointer rounded-[10px] px-[22px] py-[18px] text-[15px] font-bold text-brand">Invite a staff member</summary>
          <div className="border-t border-line px-[22px] pb-[22px] pt-5">
            <div className="mb-4">
              <Notice>
                Supabase Auth sends the invitation email. The Supabase project needs SMTP configured (the default mailer is strictly rate-limited); if the email does not arrive, check the Auth logs.
              </Notice>
            </div>
            <ActionForm action={inviteMember} resetOnSuccess>
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_200px_auto] md:items-end">
                <Field label="Email" htmlFor="inv-email">
                  <input id="inv-email" name="email" type="email" required maxLength={254} autoComplete="off" className="field" />
                </Field>
                <Field label="Name" htmlFor="inv-name">
                  <input id="inv-name" name="display_name" required maxLength={120} className="field" />
                </Field>
                <Field label="Role" htmlFor="inv-role">
                  <select id="inv-role" name="role" defaultValue="writer" className="field">
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </Field>
                <SubmitButton pendingLabel="Sending…">Invite</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </details>
      )}

      <Panel flush>
        <Toolbar>
          <ToolbarTabs
            label="Account status"
            tabs={[undefined, ...STATUSES].map((s) => ({
              key: s ?? "all",
              label: s ? STATUS[s].label : "All",
              href: withParams("/admin/team", { ...params, status: s }),
              current: s === status,
            }))}
          />
          <ToolbarSearch action="/admin/team" label="Search accounts" placeholder="Search name or email…" defaultValue={q} hidden={{ status, edit: params.edit }} />
        </Toolbar>

        {visible.length === 0 ? (
          <Empty bare title="No accounts found">
            Try another search or status.
          </Empty>
        ) : (
          <RecordList label="Newsroom accounts">
            {visible.map((m) => (
              <MemberRow key={m.id} m={m} isSelf={m.id === ctx.userId} canManage={canManage} callerIsOwner={ctx.role === "owner"} roles={roles} />
            ))}
          </RecordList>
        )}

        <div className="border-t border-line">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={found.length}
            pageSize={PAGE_SIZE}
            noun={found.length === 1 ? "account" : "accounts"}
            hrefFor={(p) => withParams("/admin/team", { ...params, page: p })}
          />
        </div>
      </Panel>
      <p className="mb-8 mt-2 text-xs text-muted">
        Role changes and deactivations take effect immediately on every database permission. You cannot change your own role or deactivate yourself; there is always at least one active Owner.
      </p>

      <PermissionMatrixView matrix={matrix} canEdit={ctx.permissions.has("roles.manage")} editRole={editRole} />
    </>
  );
}

function MemberRow({ m, isSelf, canManage, callerIsOwner, roles }: { m: TeamMember; isSelf: boolean; canManage: boolean; callerIsOwner: boolean; roles: readonly AppRole[] }) {
  const protectedOwner = m.role === "owner" && !callerIsOwner;
  const editable = canManage && !isSelf && !protectedOwner;
  const status = statusOf(m);
  const name = m.displayName.trim() || "Unnamed account";
  return (
    <RecordRow
      actions={
        editable && (
          <div className="w-full space-y-2.5 min-[761px]:w-[300px]">
            <ActionForm action={changeRole}>
              <input type="hidden" name="id" value={m.id} />
              <div className="flex items-center gap-2">
                <label htmlFor={`role-${m.id}`} className="sr-only">
                  Role for {name}
                </label>
                <select id={`role-${m.id}`} name="role" defaultValue={m.role} className="field min-h-9 min-w-0 flex-1 py-1.5 text-[13px]">
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <SubmitButton variant="outline" pendingLabel="…" className={SMALL}>
                  Change
                </SubmitButton>
              </div>
            </ActionForm>
            <ActionForm
              action={setMemberActive}
              confirm={m.isActive ? `Deactivate ${name}? They lose access immediately and can no longer sign in.` : undefined}
            >
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="active" value={m.isActive ? "false" : "true"} />
              <SubmitButton variant={m.isActive ? "danger" : "outline"} pendingLabel="…" className={SMALL}>
                {m.isActive ? "Deactivate" : "Reactivate"}
              </SubmitButton>
            </ActionForm>
          </div>
        )
      }
    >
      <RecordMeta>
        <StatusBadge status={status} map={STATUS} />
        {status === "deactivated" && m.deactivatedAt && <span>{formatDateTime(m.deactivatedAt)}</span>}
        {isSelf && <span>Current account</span>}
      </RecordMeta>
      <RecordTitle>
        <Link href={`/admin/team/${m.id}`} className="hover:text-brand">
          {name}
        </Link>
      </RecordTitle>
      {m.email && (
        <a href={`mailto:${m.email}`} className="break-all text-[13px] font-semibold text-brand hover:underline">
          {m.email}
        </a>
      )}
      <p className="mt-2 text-xs text-muted">
        {ROLE_LABELS[m.role]}
        {m.title ? ` · ${m.title}` : ""} · {m.lastSignInAt ? `Last sign-in ${formatDateTime(m.lastSignInAt)}` : "Never signed in"}
      </p>
    </RecordRow>
  );
}
