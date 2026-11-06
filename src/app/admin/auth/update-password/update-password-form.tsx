"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { updatePassword, type PasswordState } from "@/app/admin/auth/update-password/actions";

export function UpdatePasswordForm({ email, rules }: { email: string; rules: string }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(updatePassword, {});
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      {/* Lets password managers save the new password against the right account. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">Bagong password</span>
        <input
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          aria-describedby="new-password-rules"
          className="field h-12 text-base"
        />
        <span id="new-password-rules" className="text-sm text-muted">
          {rules}
        </span>
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">Ulitin ang password</span>
        <input name="confirm" type="password" required minLength={12} autoComplete="new-password" className="field h-12 text-base" />
      </label>
      {state.error && (
        <p role="alert" className="rounded bg-accent/8 px-3.5 py-3 text-sm text-accent-700">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary h-12 w-full text-[0.95rem]" disabled={pending} aria-busy={pending}>
        {pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
        {pending ? "Sine-save…" : "I-save at pumasok sa Studio"}
      </button>
    </form>
  );
}
