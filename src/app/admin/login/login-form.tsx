"use client";

import { useActionState, useState } from "react";
import { requestPasswordReset, signIn, type LoginState } from "@/app/admin/login/actions";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [loginState, loginAction, loginPending] = useActionState<LoginState, FormData>(signIn, {});
  const [resetState, resetAction, resetPending] = useActionState<LoginState, FormData>(requestPasswordReset, {});

  if (mode === "reset") {
    return (
      <form action={resetAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">Email</span>
          <input name="email" type="email" required autoComplete="email" className="field" />
        </label>
        {resetState.error && <p role="alert" className="text-sm text-accent-700">{resetState.error}</p>}
        {resetState.message && <p role="status" className="text-sm text-brand-700">{resetState.message}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={resetPending}>
          {resetPending ? "Ipinapadala…" : "Magpadala ng reset link"}
        </button>
        <button type="button" className="w-full text-sm font-semibold text-brand hover:underline" onClick={() => setMode("login")}>
          Bumalik sa login
        </button>
      </form>
    );
  }

  return (
    <form action={loginAction} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Email</span>
        <input name="email" type="email" required autoComplete="username" className="field" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className="field" />
      </label>
      {loginState.error && <p role="alert" className="text-sm text-accent-700">{loginState.error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={loginPending}>
        {loginPending ? "Nagla-login…" : "Mag-login"}
      </button>
      <button type="button" className="w-full text-sm font-semibold text-brand hover:underline" onClick={() => setMode("reset")}>
        Nakalimutan ang password?
      </button>
    </form>
  );
}
