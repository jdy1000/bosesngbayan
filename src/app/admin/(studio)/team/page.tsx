import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { ROLE_LABELS, ROLES } from "@/lib/auth/permissions";
import { assignableRoles, loadPermissionMatrix, loadTeam, type TeamMember } from "@/lib/studio/team";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Badge, Field, Notice, PageHeader, Panel, Table } from "@/components/studio/ui";
import { changeRole, inviteMember, setMemberActive } from "./actions";
import { PermissionMatrixView } from "./permission-matrix";

export const metadata: Metadata = { title: "Team and Roles" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const ctx = await requireStaffPage("users.view");
  const { edit } = await searchParams;
  const canManage = ctx.permissions.has("users.manage");
  const [members, matrix] = await Promise.all([loadTeam(ctx), loadPermissionMatrix(ctx)]);
  const roles = assignableRoles(ctx.role);

  return (
    <>
      <PageHeader
        title="Team and Roles"
        description="Boses ng Bayan Studio staff. There is no public registration: an invitation is the only way to get an account."
      />

      {canManage && (
        <Panel title="Invite staff" className="mb-6">
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
        </Panel>
      )}

      <section aria-labelledby="members-heading" className="mb-8">
        <h2 id="members-heading" className="mb-3 text-[0.95rem] font-bold text-ink">
          Members ({members.length})
        </h2>
        <Table head={["Name", "Role", "Status", "Last sign-in", ""]}>
          {members.map((m) => (
            <MemberRow key={m.id} m={m} isSelf={m.id === ctx.userId} canManage={canManage} callerIsOwner={ctx.role === "owner"} roles={roles} />
          ))}
        </Table>
        <p className="mt-2 text-xs text-muted">
          Role changes and deactivations take effect immediately on every database permission. You cannot change your own role or deactivate yourself; there is always at least one active Owner.
        </p>
      </section>

      <PermissionMatrixView matrix={matrix} canEdit={ctx.permissions.has("roles.manage")} editRole={ROLES.find((r) => r === edit && r !== "owner") ?? null} />
    </>
  );
}

function MemberRow({ m, isSelf, canManage, callerIsOwner, roles }: { m: TeamMember; isSelf: boolean; canManage: boolean; callerIsOwner: boolean; roles: readonly string[] }) {
  const protectedOwner = m.role === "owner" && !callerIsOwner;
  const editable = canManage && !isSelf && !protectedOwner;
  const pending = !m.confirmedAt && !m.lastSignInAt && m.invitedAt;
  return (
    <tr className={m.isActive ? "" : "bg-surface/60"}>
      <td>
        <Link href={`/admin/team/${m.id}`} className="font-semibold text-ink hover:text-brand">
          {m.displayName}
        </Link>
        {isSelf && <span className="ml-1.5 text-xs text-muted">(you)</span>}
        <span className="block text-xs text-muted">{m.email ?? "—"}{m.title ? ` · ${m.title}` : ""}</span>
      </td>
      <td>
        {editable ? (
          <ActionForm action={changeRole} className="flex items-center gap-2">
            <input type="hidden" name="id" value={m.id} />
            <label htmlFor={`role-${m.id}`} className="sr-only">
              Role for {m.displayName}
            </label>
            <select id={`role-${m.id}`} name="role" defaultValue={m.role} className="field min-h-9 w-36 py-1 text-sm">
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                </option>
              ))}
            </select>
            <SubmitButton variant="outline" pendingLabel="…" className="!min-h-9 !px-3">
              Change
            </SubmitButton>
          </ActionForm>
        ) : (
          <Badge tone={m.role === "owner" ? "navy" : "blue"}>{ROLE_LABELS[m.role]}</Badge>
        )}
      </td>
      <td>
        {!m.isActive ? (
          <Badge tone="red">Deactivated</Badge>
        ) : pending ? (
          <Badge tone="amber">Invited</Badge>
        ) : (
          <Badge tone="green">Active</Badge>
        )}
        {!m.isActive && m.deactivatedAt && <span className="block text-xs text-muted">{formatDateTime(m.deactivatedAt)}</span>}
      </td>
      <td className="whitespace-nowrap text-xs text-muted">{m.lastSignInAt ? formatDateTime(m.lastSignInAt) : "Never"}</td>
      <td className="text-right">
        {editable && (
          <ActionForm
            action={setMemberActive}
            confirm={m.isActive ? `Deactivate ${m.displayName}? They lose access immediately and can no longer sign in.` : undefined}
          >
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="active" value={m.isActive ? "false" : "true"} />
            <SubmitButton variant={m.isActive ? "ghost" : "outline"} pendingLabel="…" className={`!min-h-9 !px-3 ${m.isActive ? "text-accent-700" : ""}`}>
              {m.isActive ? "Deactivate" : "Reactivate"}
            </SubmitButton>
          </ActionForm>
        )}
      </td>
    </tr>
  );
}
