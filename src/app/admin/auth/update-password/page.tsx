import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/studio/auth-shell";
import { PASSWORD_RULES } from "@/lib/auth/password";
import { signOut } from "@/app/admin/login/actions";
import { isRecentLinkSession, LINK_EXPIRED_URL } from "@/app/admin/auth/update-password/recent-link";
import { UpdatePasswordForm } from "@/app/admin/auth/update-password/update-password-form";

export const metadata: Metadata = { title: "New password — Boses ng Bayan Studio", robots: { index: false } };

/** Reached from an invitation or recovery email. The action repeats both checks; this one only avoids showing a form it would refuse. */
export default async function UpdatePasswordPage() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(LINK_EXPIRED_URL);
  const { data: token } = await supabase.auth.getClaims();
  if (!isRecentLinkSession(token?.claims.amr)) redirect(LINK_EXPIRED_URL);

  return (
    <AuthShell variant="plain">
      <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">Create a new password</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        For <strong className="font-semibold text-ink">{data.user.email}</strong>. After saving, you sign in with the new password.
      </p>
      <UpdatePasswordForm email={data.user.email ?? ""} rules={PASSWORD_RULES} />
      {/* A form, not a link: the emailed link already signed this browser in, and going back should end that session. */}
      <form action={signOut} className="mt-4">
        <button type="submit" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand-700">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to sign in
        </button>
      </form>
    </AuthShell>
  );
}
