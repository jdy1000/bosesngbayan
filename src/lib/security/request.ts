import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * CSRF defence for public JSON POST endpoints: require an Origin (or Referer) header that matches
 * this deployment. Combined with JSON-only bodies this blocks cross-site form posts.
 */
export function isSameOrigin(request: Request): boolean {
  const allowed = new Set<string>([new URL(request.url).origin]);
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
    } catch {
      // invalid config is reported by env validation elsewhere
    }
  }
  const origin = request.headers.get("origin");
  if (origin) return allowed.has(origin);
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return allowed.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  return false;
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonOk(data: Record<string, unknown> = {}, init?: { status?: number }): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status: init?.status ?? 200, headers: { "Cache-Control": "no-store" } });
}

const MAX_BODY_BYTES = 16 * 1024;

/** Parse and validate a small JSON body. Returns a response on failure. */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T>; response?: never } | { data?: never; response: NextResponse }> {
  if (!isSameOrigin(request)) return { response: jsonError("Hindi pinapayagan ang request.", 403) };
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return { response: jsonError("JSON lamang ang tinatanggap.", 415) };
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { response: jsonError("Masyadong malaki ang request.", 413) };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { response: jsonError("Hindi wastong JSON.", 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { response: jsonError(parsed.error.issues[0]?.message ?? "Hindi wastong input.", 422) };
  }
  return { data: parsed.data };
}
