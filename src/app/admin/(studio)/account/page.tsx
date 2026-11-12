import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { PasswordInput } from "@/components/studio/password-input";
import { Badge, Field, Notice, PageHeader, Panel, ToolbarTabs } from "@/components/studio/ui";
import { changeEmail, changePassword, saveProfile, signOutEverywhere } from "./actions";

export const metadata: Metadata = { title: "My account" };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** The signed-in person's own profile and sign-in details, in the Newsmaker console's shape (ADR-021). Every action re-checks the session. */
export default async function AccountPage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireStaffPage();
  const security = one((await searchParams).tab) === "security";
  const [auth, profile] = await Promise.all([
    ctx.supabase.auth.getUser(),
    ctx.supabase.from("profiles").select("title, bio").eq("id", ctx.userId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  const user = auth.data.user;

  return (
    <>
      <PageHeader title="My account" description="Manage your profile, sign-in details, and account security." />

      <Panel className="mb-5">
        <div className="flex flex-col gap-5 min-[761px]:flex-row min-[761px]:items-center min-[761px]:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
              {ctx.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-ink">{ctx.displayName}</h2>
              <p className="truncate text-[13px] text-muted">{ctx.email}</p>
              <div className="mt-2">
                <Badge tone="blue">{ROLE_LABELS[ctx.role]}</Badge>
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
            <div>
              <dt className="text-xs text-muted">Email status</dt>
              <dd className="mt-1 font-semibold text-ink">{user?.email_confirmed_at ? "Confirmed" : "Awaiting confirmation"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Last sign-in</dt>
              <dd className="mt-1 font-semibold text-ink">{user?.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "—"}</dd>
            </div>
          </dl>
        </div>
      </Panel>

      <div className="mb-5">
        <ToolbarTabs
          label="Account settings"
          tabs={[
            { key: "profile", label: "Profile", href: "/admin/account", current: !security },
            { key: "security", label: "Security", href: "/admin/account?tab=security", current: security },
          ]}
        />
      </div>

      {security ? (
        <div className="grid gap-6 min-[1101px]:grid-cols-2 min-[1101px]:items-start">
          <div className="space-y-6">
            <Panel
              title="Change password"
              description="Use at least 12 characters with upper-case, lower-case and a digit. Other devices are signed out when you save."
            >
              <ActionForm action={changePassword} resetOnSuccess>
                {/* Lets password managers attach the new password to the right account. */}
                <input type="text" name="username" autoComplete="username" value={ctx.email ?? ""} readOnly hidden />
                <div className="space-y-5">
                  <Field label="Current password" htmlFor="account-current">
                    <PasswordInput id="account-current" name="current" required autoComplete="current-password" />
                  </Field>
                  <Field label="New password" htmlFor="account-password">
                    <PasswordInput id="account-password" name="password" required minLength={12} autoComplete="new-password" />
                  </Field>
                  <Field label="Confirm new password" htmlFor="account-confirm">
                    <PasswordInput id="account-confirm" name="confirm" required minLength={12} autoComplete="new-password" />
                  </Field>
                </div>
                <div className="mt-5">
                  <SubmitButton pendingLabel="Saving…">Update password</SubmitButton>
                </div>
              </ActionForm>
              <p className="mt-4 text-xs leading-[1.5] text-muted">
                Forgot your current password? Sign out and choose <strong className="font-semibold text-ink-soft">Forgot password?</strong> on the sign-in page.
              </p>
            </Panel>

            <Panel
              title="Email address"
              description={
                <>
                  Current address: <strong className="font-semibold text-ink">{ctx.email}</strong>
                </>
              }
            >
              {user?.new_email && (
                <div className="mb-5">
                  <Notice tone="warn">
                    Pending confirmation: <strong>{user.new_email}</strong>. Open the links sent to your old and new email.
                  </Notice>
                </div>
              )}
              <ActionForm action={changeEmail} resetOnSuccess>
                <input type="text" name="username" autoComplete="username" value={ctx.email ?? ""} readOnly hidden />
                <div className="space-y-5">
                  <Field label="New email address" htmlFor="account-email">
                    <input id="account-email" name="email" type="email" required maxLength={254} autoComplete="email" className="field" />
                  </Field>
                  <Field label="Current password" htmlFor="account-email-current" hint="Both your old and your new address get a confirmation link.">
                    <PasswordInput id="account-email-current" name="current" required autoComplete="current-password" />
                  </Field>
                </div>
                <div className="mt-5">
                  <SubmitButton pendingLabel="Sending…">Request email change</SubmitButton>
                </div>
              </ActionForm>
            </Panel>
          </div>

          <Panel title="Sign out everywhere" description="End your sessions on all devices, including this one.">
            <ActionForm action={signOutEverywhere}>
              <label className="flex items-start gap-2.5 text-sm leading-[1.5] text-ink-soft">
                <input type="checkbox" name="confirm" required className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]" />
                <span>I understand I will need to sign in again.</span>
              </label>
              <div className="mt-5">
                <SubmitButton variant="danger" pendingLabel="Signing out…">
                  Sign out everywhere
                </SubmitButton>
              </div>
            </ActionForm>
          </Panel>
        </div>
      ) : (
        <Panel title="Profile details" description="Your display name is shown in bylines on articles you write." className="max-w-[760px]">
          <ActionForm action={saveProfile}>
            <div className="space-y-5">
              <Field label="Display name" htmlFor="account-name" hint="2 to 80 characters. Public: it appears after “By” on your articles.">
                <input id="account-name" name="display_name" required minLength={2} maxLength={80} autoComplete="name" defaultValue={ctx.displayName} className="field" />
              </Field>
              <Field label="Job title" htmlFor="account-title" hint="Up to 100 characters. Public: it may be shown with your byline.">
                <input id="account-title" name="title" maxLength={100} autoComplete="organization-title" defaultValue={profile.data?.title ?? ""} className="field" />
              </Field>
              <Field label="Biography" htmlFor="account-bio" hint="Up to 500 characters. Public: it may be shown with your byline.">
                <textarea id="account-bio" name="bio" rows={5} maxLength={500} defaultValue={profile.data?.bio ?? ""} className="field" />
              </Field>
            </div>
            <div className="mt-5">
              <SubmitButton>Save profile</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      )}
    </>
  );
}
