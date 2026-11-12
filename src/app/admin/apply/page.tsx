import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/studio/auth-shell";
import { getStaffContext } from "@/lib/auth/session";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Apply for newsroom access — Boses ng Bayan Studio", robots: { index: false, follow: false } };

export default async function ApplyPage() {
  if (await getStaffContext()) redirect("/dashboard");
  return (
    <AuthShell variant="plain">
      <ApplyForm />
    </AuthShell>
  );
}
