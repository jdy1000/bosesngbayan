import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { PASSWORD_RULES } from "@/lib/auth/password";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Field, Notice, PageHeader, Panel } from "@/components/studio/ui";
import { changeEmail, changePassword } from "./actions";

export const metadata: Metadata = { title: "Aking Account" };

export default async function AccountPage() {
  const ctx = await requireStaffPage();
  const { data } = await ctx.supabase.auth.getUser();
  const pendingEmail = data.user?.new_email ?? null;

  return (
    <>
      <PageHeader title="Aking Account" description="Ang iyong login email at password. Ikaw lang ang makakapagbago nito." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Panel title="Email" description="Ginagamit sa pag-login at sa mga abiso mula sa Studio.">
            {pendingEmail && (
              <div className="mb-4">
                <Notice tone="warn">
                  Naghihintay ng kumpirmasyon: <strong>{pendingEmail}</strong>. Buksan ang link na ipinadala sa luma at bagong email.
                </Notice>
              </div>
            )}
            <ActionForm action={changeEmail} resetOnSuccess className="max-w-md space-y-4">
              <Field label="Kasalukuyang email">
                <p className="text-[0.95rem] text-ink">{ctx.email}</p>
              </Field>
              <Field label="Bagong email" htmlFor="account-email">
                <input id="account-email" name="email" type="email" required autoComplete="email" className="field" />
              </Field>
              <SubmitButton pendingLabel="Ipinapadala…">Palitan ang email</SubmitButton>
            </ActionForm>
          </Panel>

          <Panel title="Password" description="Kailangan ang kasalukuyang password bago magpalit.">
            <ActionForm action={changePassword} resetOnSuccess className="max-w-md space-y-4">
              {/* Lets password managers attach the new password to the right account. */}
              <input type="text" name="username" autoComplete="username" value={ctx.email ?? ""} readOnly hidden />
              <Field label="Kasalukuyang password" htmlFor="account-current">
                <input id="account-current" name="current" type="password" required autoComplete="current-password" className="field" />
              </Field>
              <Field label="Bagong password" htmlFor="account-password" hint={PASSWORD_RULES}>
                <input
                  id="account-password"
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className="field"
                />
              </Field>
              <Field label="Ulitin ang bagong password" htmlFor="account-confirm">
                <input id="account-confirm" name="confirm" type="password" required minLength={12} autoComplete="new-password" className="field" />
              </Field>
              <SubmitButton pendingLabel="Sine-save…">I-save ang password</SubmitButton>
            </ActionForm>
          </Panel>
        </div>

        <aside className="space-y-6 lg:self-start">
          <Panel title="Profile">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted">Pangalan</dt>
                <dd className="font-semibold text-ink">{ctx.displayName}</dd>
              </div>
              <div>
                <dt className="text-muted">Role</dt>
                <dd className="font-semibold text-ink">{ROLE_LABELS[ctx.role]}</dd>
              </div>
              {data.user?.last_sign_in_at && (
                <div>
                  <dt className="text-muted">Huling login</dt>
                  <dd className="text-ink">{formatDateTime(data.user.last_sign_in_at)}</dd>
                </div>
              )}
            </dl>
            <p className="mt-4 text-sm text-muted">Ang pangalan at role ay binabago ng administrator sa Team at Roles.</p>
          </Panel>
          <Panel title="Nakalimutan ang password?">
            <p className="text-sm text-ink-soft">
              Mag-logout at piliin ang <strong>Nakalimutan?</strong> sa login page. Padadalhan ka ng link para gumawa ng bagong password.
            </p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
