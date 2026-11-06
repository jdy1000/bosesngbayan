import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server";

const ALLOWED_NEXT = new Set(["/admin", "/admin/auth/update-password"]);
const OTP_TYPES = new Set<EmailOtpType>(["invite", "recovery", "magiclink", "email", "signup", "email_change"]);

/**
 * Handles invitation and password-recovery links (PKCE `code` or `token_hash`).
 * `next` is restricted to an allowlist so the callback cannot be used as an open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const nextParam = searchParams.get("next") ?? "/admin";
  const next = ALLOWED_NEXT.has(nextParam) ? nextParam : "/admin";
  const supabase = await createSessionClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
    // Invited users must choose a password before entering Studio.
    if (ok && type === "invite") return NextResponse.redirect(`${origin}/admin/auth/update-password`);
  }
  return NextResponse.redirect(ok ? `${origin}${next}` : `${origin}/admin/login?error=link`);
}
