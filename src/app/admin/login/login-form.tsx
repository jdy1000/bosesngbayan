"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { PasswordInput } from "@/components/studio/password-input";
import { requestPasswordReset, signIn, type LoginState } from "@/app/admin/login/actions";

// text-base keeps the fields at 16px, so iOS does not zoom the page on focus.
const fieldClass = "field h-[46px] text-base";
const labelClass = "text-sm font-semibold text-ink";
const headingClass = "text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink";
const introClass = "mt-2 text-sm leading-relaxed text-muted";

const NOTICE_TONES = {
  error: "bg-accent/8 text-accent-700",
  info: "bg-brand-50 text-brand-700",
  success: "bg-emerald-50 text-emerald-800",
} as const;

function Notice({ tone, children }: { tone: keyof typeof NOTICE_TONES; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded px-3.5 py-3 text-sm leading-snug ${NOTICE_TONES[tone]}`}>
      {children}
    </p>
  );
}

function SubmitButton({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  return (
    <button type="submit" className="btn btn-primary h-[46px] w-full justify-between px-4 text-[0.95rem]" disabled={pending} aria-busy={pending}>
      {pending ? busy : idle}
      {pending ? <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" /> : <ArrowRight aria-hidden="true" className="size-[18px]" />}
    </button>
  );
}

export function LoginForm({
  initialReset = false,
  linkExpired = false,
  notice,
}: {
  /** Open on the "forgot password" panel (`?recovery=1`, or after a failed link). */
  initialReset?: boolean;
  linkExpired?: boolean;
  /** Fixed text chosen by the page from `?notice=`; never the raw parameter. */
  notice?: string;
}) {
  const [mode, setMode] = useState<"login" | "reset">(initialReset ? "reset" : "login");
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
        <h1 className={headingClass}>Reset password</h1>
        <p className={introClass}>Enter your account email and we will send you a link to create a new password.</p>
        <form action={resetAction} className="mt-7 flex flex-col gap-6">
          {linkExpired && !resetState.message && (
            <Notice tone="error">That link is invalid, expired, or has already been used. Request a new link below and open the newest email.</Notice>
          )}
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
      <h1 className={headingClass}>Sign in to Studio</h1>
      <p className={introClass}>Use the email and password of your newsroom account.</p>

      <form action={loginAction} className="mt-7 flex flex-col gap-6">
        {notice && <Notice tone="success">{notice}</Notice>}
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
        <div className="flex flex-col gap-3">
          <SubmitButton pending={loginPending} idle="Sign in" busy="Signing in…" />
          <p className="text-center text-[11px] text-muted">Secure access for authorized editors.</p>
        </div>
      </form>
    </div>
  );
}
