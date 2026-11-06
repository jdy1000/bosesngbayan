import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "@/app/admin/auth/update-password/update-password-form";

export const metadata: Metadata = { title: "Bagong password — Boses ng Bayan Studio", robots: { index: false } };

export default async function UpdatePasswordPage() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login?error=link");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="font-serif text-2xl font-bold text-ink">Magtakda ng password</h1>
        <p className="mt-1 text-sm text-ink-soft">Para sa {data.user.email}. Hindi bababa sa 12 karakter, may malaki at maliit na titik at numero.</p>
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
