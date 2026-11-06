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

export const metadata: Metadata = { title: "Team at Roles" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const ctx = await requireStaffPage("users.view");
  const { edit } = await searchParams;
  const canManage = ctx.permissions.has("users.manage");
  const [members, matrix] = await Promise.all([loadTeam(ctx), loadPermissionMatrix(ctx)]);
  const roles = assignableRoles(ctx.role);

  return (
    <>
      <PageHeader
        title="Team at Roles"
        description="Mga staff ng Boses ng Bayan Studio. Walang pampublikong registration: imbitasyon lamang ang paraan para magkaroon ng account."
      />

      {canManage && (
        <Panel title="Mag-imbita ng staff" className="mb-6">
          <div className="mb-4">
            <Notice>
              Ipinapadala ng Supabase Auth ang email ng imbitasyon. Kailangang naka-configure ang SMTP ng Supabase project (may mahigpit na limit ang default mailer); kung hindi dumating ang email, suriin ang Auth logs.
            </Notice>
          </div>
          <ActionForm action={inviteMember} resetOnSuccess>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_200px_auto] md:items-end">
              <Field label="Email" htmlFor="inv-email">
                <input id="inv-email" name="email" type="email" required maxLength={254} autoComplete="off" className="field" />
              </Field>
              <Field label="Pangalan" htmlFor="inv-name">
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
              <SubmitButton pendingLabel="Nagpapadala…">Imbitahin</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      )}

      <section aria-labelledby="members-heading" className="mb-8">
        <h2 id="members-heading" className="mb-3 text-[0.95rem] font-bold text-ink">
          Mga miyembro ({members.length})
        </h2>
        <Table head={["Pangalan", "Role", "Status", "Huling login", ""]}>
          {members.map((m) => (
            <MemberRow key={m.id} m={m} isSelf={m.id === ctx.userId} canManage={canManage} callerIsOwner={ctx.role === "owner"} roles={roles} />
          ))}
        </Table>
        <p className="mt-2 text-xs text-muted">
          Ang pagbabago ng role o pag-deactivate ay may bisa agad sa lahat ng pahintulot sa database. Hindi mo mababago ang sarili mong role o ma-deactivate ang sarili; laging may kahit isang aktibong Owner.
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
        {isSelf && <span className="ml-1.5 text-xs text-muted">(ikaw)</span>}
        <span className="block text-xs text-muted">{m.email ?? "—"}{m.title ? ` · ${m.title}` : ""}</span>
      </td>
      <td>
        {editable ? (
          <ActionForm action={changeRole} className="flex items-center gap-2">
            <input type="hidden" name="id" value={m.id} />
            <label htmlFor={`role-${m.id}`} className="sr-only">
              Role ni {m.displayName}
            </label>
            <select id={`role-${m.id}`} name="role" defaultValue={m.role} className="field min-h-9 w-36 py-1 text-sm">
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                </option>
              ))}
            </select>
            <SubmitButton variant="outline" pendingLabel="…" className="!min-h-9 !px-3">
              Baguhin
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
          <Badge tone="amber">Naimbitahan</Badge>
        ) : (
          <Badge tone="green">Aktibo</Badge>
        )}
        {!m.isActive && m.deactivatedAt && <span className="block text-xs text-muted">{formatDateTime(m.deactivatedAt)}</span>}
      </td>
      <td className="whitespace-nowrap text-xs text-muted">{m.lastSignInAt ? formatDateTime(m.lastSignInAt) : "Hindi pa"}</td>
      <td className="text-right">
        {editable && (
          <ActionForm
            action={setMemberActive}
            confirm={m.isActive ? `I-deactivate si ${m.displayName}? Mawawala agad ang access niya at hindi na siya makakapag-login.` : undefined}
          >
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="active" value={m.isActive ? "false" : "true"} />
            <SubmitButton variant={m.isActive ? "ghost" : "outline"} pendingLabel="…" className={`!min-h-9 !px-3 ${m.isActive ? "text-accent-700" : ""}`}>
              {m.isActive ? "I-deactivate" : "I-reactivate"}
            </SubmitButton>
          </ActionForm>
        )}
      </td>
    </tr>
  );
}
