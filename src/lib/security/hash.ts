import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/server-env";

/** HMAC-SHA256 hex (64 chars). Raw identifiers are never persisted — only these hashes. */
export function hmac(scope: string, value: string): string {
  return createHmac("sha256", serverEnv().HASH_SECRET).update(`${scope}:${value}`).digest("hex");
}

/** Manila calendar day, used to rotate visitor hashes daily (no cross-day tracking). */
export function manilaDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(date);
}

export function clientIp(headers: Headers): string {
  // Trust only the first hop added by the platform proxy (Vercel sets x-forwarded-for / x-real-ip).
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

export function networkHash(headers: Headers): string {
  return hmac("network", clientIp(headers));
}

export function visitorHash(headers: Headers, date = new Date()): string {
  return hmac(`visitor:${manilaDay(date)}`, `${clientIp(headers)}|${headers.get("user-agent") ?? ""}`);
}

export function voterHash(voterToken: string): string {
  return hmac("voter", voterToken);
}

export function newVoterToken(): string {
  return randomUUID();
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|discordbot|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch|go-http-client/i;

export function isLikelyBot(userAgent: string | null): boolean {
  if (!userAgent || userAgent.length < 10) return true;
  return BOT_PATTERN.test(userAgent);
}
