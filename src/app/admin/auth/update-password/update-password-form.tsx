"use client";

import { useActionState } from "react";
import { updatePassword, type PasswordState } from "@/app/admin/auth/update-password/actions";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(updatePassword, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Bagong password</span>
        <input name="password" type="password" required minLength={12} autoComplete="new-password" className="field" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Ulitin ang password</span>
        <input name="confirm" type="password" required minLength={12} autoComplete="new-password" className="field" />
      </label>
      {state.error && <p role="alert" className="text-sm text-accent-700">{state.error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Sine-save…" : "I-save ang password"}
      </button>
    </form>
  );
}
