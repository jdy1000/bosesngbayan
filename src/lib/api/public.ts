import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logServerError } from "@/lib/log";

/** Wraps a public read endpoint: consistent envelope, safe errors, short shared cache. */
export async function publicRead(event: string, fn: () => Promise<unknown | null>): Promise<NextResponse> {
  try {
    const data = await fn();
    if (data === null) return NextResponse.json({ ok: false, error: "Hindi nahanap." }, { status: 404 });
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.issues[0]?.message ?? "Hindi wastong query." }, { status: 400 });
    }
    logServerError(event, error);
    return NextResponse.json({ ok: false, error: "May nangyaring error." }, { status: 500 });
  }
}

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

export function queryObject(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}
