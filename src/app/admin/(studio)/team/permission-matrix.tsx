import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { ROLE_LABELS, ROLES, type AppRole } from "@/lib/auth/permissions";
import type { PermissionMatrix } from "@/lib/studio/team";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Notice, Panel } from "@/components/studio/ui";
import { saveRolePermissions } from "./actions";

/** Read-only matrix for users.view; the Owner (roles.manage) can edit one non-owner role at a time. */
export function PermissionMatrixView({ matrix, canEdit, editRole }: { matrix: PermissionMatrix; canEdit: boolean; editRole: AppRole | null }) {
  const has = (role: AppRole, key: string) => matrix.granted.has(`${role}:${key}`);
  return (
    <Panel
      title="Permission matrix"
      description="The database enforces these permissions (RLS and server actions), not just the buttons in Studio."
      actions={
        canEdit && (
          <div className="flex flex-wrap gap-1.5">
            {ROLES.filter((r) => r !== "owner").map((r) => (
              <Link key={r} href={`/admin/team?edit=${r}#matrix`} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${editRole === r ? "border-brand bg-brand-50 text-brand" : "border-line hover:border-brand"}`}>
                Edit: {ROLE_LABELS[r]}
              </Link>
            ))}
          </div>
        )
      }
    >
      <div id="matrix" className="scroll-mt-6" />
      {editRole && canEdit && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <h3 className="mb-1 text-sm font-bold text-ink">Permissions for {ROLE_LABELS[editRole]}</h3>
          <div className="mb-3">
            <Notice tone="warn">Changes take effect immediately for everyone with this role. Owner and “roles.manage” are locked. Every change is audited.</Notice>
          </div>
          <ActionForm action={saveRolePermissions} key={editRole}>
            <input type="hidden" name="role" value={editRole} />
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {matrix.permissions.map((p) => (
                <label key={p.key} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="perm" value={p.key} defaultChecked={has(editRole, p.key)} disabled={p.key === "roles.manage"} className="mt-0.5 h-4 w-4" />
                  <span>
                    <span className="font-mono text-xs font-semibold text-ink">{p.key}</span>
                    <span className="block text-xs text-muted">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <SubmitButton>Save permissions</SubmitButton>
              <Link href="/admin/team#matrix" className="text-sm font-semibold text-ink-soft hover:text-ink">
                Cancel
              </Link>
            </div>
          </ActionForm>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="py-2 pr-4">Permission</th>
              {ROLES.map((r) => (
                <th key={r} scope="col" className="px-2 py-2 text-center">
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {matrix.permissions.map((p, i) => (
              <tr key={p.key}>
                <th scope="row" className="py-2 pr-4 font-normal">
                  {(i === 0 || matrix.permissions[i - 1]!.group_name !== p.group_name) && (
                    <span className="block text-[0.7rem] font-bold uppercase tracking-wide text-brand">{p.group_name}</span>
                  )}
                  <span className="font-mono text-xs text-ink">{p.key}</span>
                  <span className="block text-xs text-muted">{p.description}</span>
                </th>
                {ROLES.map((r) => (
                  <td key={r} className="px-2 py-2 text-center">
                    {has(r, p.key) ? (
                      <>
                        <Check className="mx-auto h-4 w-4 text-emerald-700" aria-hidden="true" />
                        <span className="sr-only">Granted</span>
                      </>
                    ) : (
                      <>
                        <Minus className="mx-auto h-4 w-4 text-line" aria-hidden="true" />
                        <span className="sr-only">Not granted</span>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
