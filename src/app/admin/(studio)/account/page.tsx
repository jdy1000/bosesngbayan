import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { PASSWORD_RULES } from "@/lib/auth/password";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { PasswordInput } from "@/components/studio/password-input";
import { Field, Notice, PageHeader, Panel } from "@/components/studio/ui";
import { changeEmail, changePassword } from "./actions";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const ctx = await requireStaffPage();
  const { data } = await ctx.supabase.auth.getUser();
  const pendingEmail = data.user?.new_email ?? null;

  return (
    <>
      <PageHeader title="My account" description="Manage your sign-in email, password, and account security." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Panel title="Email" description="Used to sign in and for notifications from Studio.">
            {pendingEmail && (
              <div className="mb-4">
                <Notice tone="warn">
                  Awaiting confirmation: <strong>{pendingEmail}</strong>. Open the link sent to your old and new email.
                </Notice>
              </div>
            )}
            <ActionForm action={changeEmail} resetOnSuccess className="max-w-md space-y-4">
              <Field label="Current email">
                <p className="text-[0.95rem] text-ink">{ctx.email}</p>
              </Field>
              <Field label="New email" htmlFor="account-email">
                <input id="account-email" name="email" type="email" required autoComplete="email" className="field" />
              </Field>
              <SubmitButton pendingLabel="Sending…">Change email</SubmitButton>
            </ActionForm>
          </Panel>

          <Panel title="Password" description="Your current password is required to change it.">
            <ActionForm action={changePassword} resetOnSuccess className="max-w-md space-y-4">
              {/* Lets password managers attach the new password to the right account. */}
              <input type="text" name="username" autoComplete="username" value={ctx.email ?? ""} readOnly hidden />
              <Field label="Current password" htmlFor="account-current">
                <PasswordInput id="account-current" name="current" required autoComplete="current-password" />
              </Field>
              <Field label="New password" htmlFor="account-password" hint={PASSWORD_RULES}>
                <PasswordInput id="account-password" name="password" required minLength={12} autoComplete="new-password" />
              </Field>
              <Field label="Repeat new password" htmlFor="account-confirm">
                <PasswordInput id="account-confirm" name="confirm" required minLength={12} autoComplete="new-password" />
              </Field>
              <SubmitButton pendingLabel="Saving…">Save password</SubmitButton>
            </ActionForm>
          </Panel>
        </div>

        <aside className="space-y-6 lg:self-start">
          <Panel title="Profile">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted">Name</dt>
                <dd className="font-semibold text-ink">{ctx.displayName}</dd>
              </div>
              <div>
                <dt className="text-muted">Role</dt>
                <dd className="font-semibold text-ink">{ROLE_LABELS[ctx.role]}</dd>
              </div>
              {data.user?.last_sign_in_at && (
                <div>
                  <dt className="text-muted">Last sign-in</dt>
                  <dd className="text-ink">{formatDateTime(data.user.last_sign_in_at)}</dd>
                </div>
              )}
            </dl>
            <p className="mt-4 text-sm text-muted">Your name and role are changed by an administrator in Team & roles.</p>
          </Panel>
          <Panel title="Forgot your password?">
            <p className="text-sm text-ink-soft">
              Sign out and choose <strong>Forgot password?</strong> on the sign-in page. We will send you a link to create a new password.
            </p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
