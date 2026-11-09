"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { PasswordInput } from "@/components/studio/password-input";
import { requestPasswordReset, signIn, type LoginState } from "@/app/admin/login/actions";

const fieldClass = "field h-12 text-base";
const labelClass = "text-sm font-semibold text-ink";

function Notice({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  const styles = tone === "error" ? "bg-accent/8 text-accent-700" : "bg-brand-50 text-brand-700";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded px-3.5 py-3 text-sm leading-snug ${styles}`}>
      {children}
    </p>
  );
}

function SubmitButton({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  return (
    <button type="submit" className="btn btn-primary h-12 w-full text-[0.95rem]" disabled={pending} aria-busy={pending}>
      {pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
      {pending ? busy : idle}
    </button>
  );
}

export function LoginForm({ linkExpired = false }: { linkExpired?: boolean }) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  // Focus moves to the email field only after the reader switches mode, never on first load.
  const [switched, setSwitched] = useState(false);
  const [email, setEmail] = useState("");
  const [loginState, loginAction, loginPending] = useActionState<LoginState, FormData>(signIn, {});
  const [resetState, resetAction, resetPending] = useActionState<LoginState, FormData>(requestPasswordReset, {});

  function switchTo(next: "login" | "reset") {
    setSwitched(true);
    setMode(next);
  }

  const emailField = (
    <label className="flex flex-col gap-2">
      <span className={labelClass}>Email</span>
      <input
        name="email"
        type="email"
        required
        autoComplete={mode === "login" ? "username" : "email"}
        autoFocus={switched}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={fieldClass}
      />
    </label>
  );

  if (mode === "reset") {
    return (
      <div>
        <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">Reset password</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-soft">
          Enter your account email and we will send you a link to create a new password.
        </p>
        <form action={resetAction} className="mt-8 flex flex-col gap-5">
          {emailField}
          {resetState.error && <Notice tone="error">{resetState.error}</Notice>}
          {resetState.message && <Notice tone="info">{resetState.message}</Notice>}
          <SubmitButton pending={resetPending} idle="Send reset link" busy="Sending…" />
        </form>
        <button
          type="button"
          onClick={() => switchTo("login")}
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand-700"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">Sign in to Studio</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-soft">Use the email and password of your newsroom account.</p>

      <form action={loginAction} className="mt-8 flex flex-col gap-5">
        {linkExpired && <Notice tone="error">This link has expired or is invalid. Ask for a new invitation or reset your password.</Notice>}
        {emailField}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor="login-password" className={labelClass}>
              Password
            </label>
            <button
              type="button"
              onClick={() => switchTo("reset")}
              className="text-sm font-semibold text-brand transition-colors hover:text-brand-700"
            >
              Forgot password?
            </button>
          </div>
          <PasswordInput id="login-password" name="password" required autoComplete="current-password" className={fieldClass} />
        </div>
        {loginState.error && <Notice tone="error">{loginState.error}</Notice>}
        <SubmitButton pending={loginPending} idle="Sign in" busy="Signing in…" />
      </form>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        No account? Accounts are by invitation only, from a site editor or administrator.{" "}
        <Link href="/admin/apply" className="font-semibold text-brand transition-colors hover:text-brand-700">
          Apply for newsroom access
        </Link>
      </p>
    </div>
  );
}
