import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/server-env";

/** Cron endpoints require `Authorization: Bearer <CRON_SECRET>` (the header Vercel Cron sends). */
export function isAuthorizedCron(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false; // not configured → endpoint disabled
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
