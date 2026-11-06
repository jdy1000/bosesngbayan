"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

export type FormActionResult =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
  | null;

/**
 * Standard Studio form: runs a server action, shows its success/error message, and optionally
 * navigates on success. Server actions remain responsible for validation and authorization.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
}: {
  action: (prev: FormActionResult, formData: FormData) => Promise<FormActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      if (state.redirectTo) router.push(state.redirectTo);
      else router.refresh();
    }
  }, [state, resetOnSuccess, router]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-3 text-sm font-medium ${state.ok ? "text-emerald-700" : "text-accent-700"}`}
        >
          {state.ok ? state.message ?? "Saved." : state.error}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  name,
  value,
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "outline" | "danger" | "ghost";
  name?: string;
  value?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const cls = {
    primary: "btn btn-primary",
    outline: "btn btn-outline",
    danger: "btn bg-accent text-white hover:bg-accent-700",
    ghost: "btn text-ink-soft hover:bg-surface-2",
  }[variant];
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${cls} min-h-10 px-4 text-sm ${className}`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
