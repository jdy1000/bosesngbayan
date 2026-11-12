"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { submitApplication, type ApplyState } from "@/app/admin/apply/actions";

// Same control metrics as the sign-in form (login-form.tsx).
const fieldClass = "field h-[46px] text-base";
const labelClass = "text-sm font-semibold text-ink";
const headingClass = "text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink";
const introClass = "mt-2 text-sm leading-relaxed text-muted";

function Label({ text, optional = false }: { text: string; optional?: boolean }) {
  return (
    <span className={labelClass}>
      {text}
      {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
    </span>
  );
}

export function ApplyForm() {
  const [state, action, pending] = useActionState<ApplyState, FormData>(submitApplication, {});
  const v = state.values ?? {};

  if (state.message) {
    return (
      <div>
        <h1 className={headingClass}>Application received</h1>
        <p role="status" className="mt-3 text-sm leading-relaxed text-ink-soft">
          {state.message}
        </p>
        <BackToLogin />
      </div>
    );
  }

  return (
    <div>
      <h1 className={headingClass}>Apply for newsroom access</h1>
      <p className={introClass}>
        Want to write or moderate for Boses ng Bayan? Tell us about yourself. Applying does not create an account: an administrator reviews every request first.
      </p>

      <form action={action} className="mt-7 flex flex-col gap-6">
        <label className="flex flex-col gap-2">
          <Label text="Full name" />
          <input name="full_name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={v.full_name} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-2">
          <Label text="Email" />
          <input name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={v.email} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-2">
          <Label text="I would like to join as" />
          <select name="requested_role" defaultValue={v.requested_role || "writer"} className={fieldClass}>
            <option value="writer">Writer: draft stories for editorial review</option>
            <option value="moderator">Moderator: review community posts and comments</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <Label text="Organization or school" optional />
          <input name="organization" maxLength={160} autoComplete="organization" defaultValue={v.organization} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-2">
          <Label text="Portfolio or writing sample link" optional />
          <input name="portfolio_url" type="url" maxLength={500} placeholder="https://" defaultValue={v.portfolio_url} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-2">
          <Label text="Why do you want to join?" />
          <textarea name="message" required minLength={20} maxLength={2000} rows={5} defaultValue={v.message} className="field py-3 text-base" />
          <span className="text-xs text-muted">20 to 2,000 characters.</span>
        </label>
        {/* Honeypot: real visitors never see or fill this field. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <label className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
          <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand)]" />
          <span>
            I agree that Boses ng Bayan may store these details to review my application. Only site administrators can see them, and they are deleted 180 days after a decision. See the{" "}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full load so <html lang> switches to the site language */}
            <a href="/privacy-policy" className="font-semibold text-brand hover:text-brand-700">
              Privacy Policy
            </a>
            .
          </span>
        </label>
        {state.error && (
          <p role="alert" className="rounded bg-accent/8 px-3.5 py-3 text-sm leading-snug text-accent-700">
            {state.error}
          </p>
        )}
        <button type="submit" className="btn btn-primary h-[46px] w-full justify-between px-4 text-[0.95rem]" disabled={pending} aria-busy={pending}>
          {pending ? "Sending…" : "Submit application"}
          {pending ? <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" /> : <ArrowRight aria-hidden="true" className="size-[18px]" />}
        </button>
      </form>
      <BackToLogin />
    </div>
  );
}

function BackToLogin() {
  return (
    <Link href="/admin/login" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand-700">
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to sign in
    </Link>
  );
}
