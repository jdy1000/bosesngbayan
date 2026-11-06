import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/public/logo";
import { LoginForm } from "@/app/admin/login/login-form";
import { getStaffContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mag-login — Boses ng Bayan Studio", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getStaffContext()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo siteName="Boses ng Bayan" size="lg" />
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-muted">Studio</p>
        </div>
        <div className="card p-7 sm:p-8">
          <h1 className="font-serif text-2xl font-bold text-ink">Mag-login sa newsroom</h1>
          <p className="mt-1 text-sm text-ink-soft">Para lamang sa mga inanyayahang miyembro ng team.</p>
          {error === "link" && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-accent-700">
              Nag-expire o hindi wasto ang link. Humingi ng bagong imbitasyon o i-reset ang password.
            </p>
          )}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
