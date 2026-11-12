import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/studio/auth-shell";
import { LoginForm } from "@/app/admin/login/login-form";
import { getStaffContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in — Boses ng Bayan Studio", robots: { index: false, follow: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** What the green banner says. The key comes from the URL, so only these fixed texts can be shown. */
const NOTICES: Record<string, string> = {
  "password-reset": "Your password has been updated. Sign in with your new password.",
  "signed-out": "You have been signed out. Sign in to continue.",
};

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  if (await getStaffContext()) redirect("/dashboard");
  const sp = await searchParams;
  const error = one(sp.error);
  const noticeKey = one(sp.notice);
  // `link` is what the auth callback sends for a failed link; `expired` is what the new-password screen sends.
  const linkExpired = error === "link" || error === "expired";

  return (
    <AuthShell>
      <LoginForm
        initialReset={linkExpired || one(sp.recovery) === "1"}
        linkExpired={linkExpired}
        notice={Object.hasOwn(NOTICES, noticeKey) ? NOTICES[noticeKey] : undefined}
      />
      <div className="mt-7 border-t border-line pt-5 text-xs leading-[1.6] text-muted">
        <strong className="block font-semibold text-ink">Need access or help signing in?</strong>
        <p className="mt-1">
          <Link href="/admin/apply" className="font-semibold text-brand transition-colors hover:text-brand-700">
            Apply for newsroom access
          </Link>
          , or use Forgot password to recover an existing account.
        </p>
      </div>
    </AuthShell>
  );
}
