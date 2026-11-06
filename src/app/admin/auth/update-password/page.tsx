import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/studio/auth-shell";
import { PASSWORD_RULES } from "@/lib/auth/password";
import { UpdatePasswordForm } from "@/app/admin/auth/update-password/update-password-form";

export const metadata: Metadata = { title: "Bagong password — Boses ng Bayan Studio", robots: { index: false } };

export default async function UpdatePasswordPage() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login?error=link");
  return (
    <AuthShell>
      <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">Gumawa ng bagong password</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-soft">
        Para sa <strong className="font-semibold text-ink">{data.user.email}</strong>.
      </p>
      <UpdatePasswordForm email={data.user.email ?? ""} rules={PASSWORD_RULES} />
    </AuthShell>
  );
}
