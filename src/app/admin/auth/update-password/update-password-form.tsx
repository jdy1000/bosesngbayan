"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { PasswordInput } from "@/components/studio/password-input";
import { updatePassword, type PasswordState } from "@/app/admin/auth/update-password/actions";

// Same control metrics as the sign-in form (login-form.tsx).
const fieldClass = "field h-[46px] text-base";
const labelClass = "text-sm font-semibold text-ink";

export function UpdatePasswordForm({ email, rules }: { email: string; rules: string }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(updatePassword, {});
  return (
    <form action={action} className="mt-7 flex flex-col gap-6">
      {/* Lets password managers save the new password against the right account. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className="flex flex-col gap-2">
        <label htmlFor="new-password" className={labelClass}>
          New password
        </label>
        <PasswordInput
          id="new-password"
          name="password"
          required
          minLength={12}
          autoComplete="new-password"
          aria-describedby="new-password-rules"
          className={fieldClass}
        />
        <span id="new-password-rules" className="text-xs text-muted">
          {rules}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="confirm-password" className={labelClass}>
          Repeat password
        </label>
        <PasswordInput id="confirm-password" name="confirm" required minLength={12} autoComplete="new-password" className={fieldClass} />
      </div>
      {state.error && (
        <p role="alert" className="rounded bg-accent/8 px-3.5 py-3 text-sm leading-snug text-accent-700">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary h-[46px] w-full justify-between px-4 text-[0.95rem]" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save new password"}
        {pending ? <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" /> : <ArrowRight aria-hidden="true" className="size-[18px]" />}
      </button>
    </form>
  );
}
