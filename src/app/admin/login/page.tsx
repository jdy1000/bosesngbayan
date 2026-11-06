import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/studio/auth-shell";
import { LoginForm } from "@/app/admin/login/login-form";
import { getStaffContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mag-login — Boses ng Bayan Studio", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getStaffContext()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <AuthShell>
      <LoginForm linkExpired={error === "link"} />
    </AuthShell>
  );
}
