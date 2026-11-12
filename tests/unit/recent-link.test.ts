import { describe, expect, it } from "vitest";
import { isRecentLinkSession } from "@/app/admin/auth/update-password/recent-link";

const NOW = 1_800_000_000; // seconds since the epoch
const entry = (method: string, secondsAgo: number) => ({ method, timestamp: NOW - secondsAgo });

describe("isRecentLinkSession (gate of the new-password screen)", () => {
  it.each(["recovery", "invite", "otp", "magiclink"])("accepts a %s sign-in from the last 15 minutes", (method) => {
    expect(isRecentLinkSession([entry(method, 60)], NOW)).toBe(true);
  });

  it("accepts a link sign-in listed after an older password sign-in", () => {
    expect(isRecentLinkSession([entry("password", 86_400), entry("recovery", 10)], NOW)).toBe(true);
  });

  it("refuses a password session, however recent", () => {
    expect(isRecentLinkSession([entry("password", 5)], NOW)).toBe(false);
  });

  it("refuses a link sign-in older than 15 minutes", () => {
    expect(isRecentLinkSession([entry("recovery", 15 * 60 + 1)], NOW)).toBe(false);
  });

  it("refuses a timestamp from the future beyond the 30-second clock allowance", () => {
    expect(isRecentLinkSession([entry("recovery", -31)], NOW)).toBe(false);
    expect(isRecentLinkSession([entry("recovery", -20)], NOW)).toBe(true);
  });

  it("fails closed on anything that is not a list of { method, timestamp }", () => {
    expect(isRecentLinkSession(undefined, NOW)).toBe(false);
    expect(isRecentLinkSession(null, NOW)).toBe(false);
    expect(isRecentLinkSession("recovery", NOW)).toBe(false);
    expect(isRecentLinkSession(["recovery"], NOW)).toBe(false); // string form carries no time
    expect(isRecentLinkSession([{ method: "recovery" }], NOW)).toBe(false);
    expect(isRecentLinkSession([{ method: "recovery", timestamp: String(NOW) }], NOW)).toBe(false);
    expect(isRecentLinkSession([], NOW)).toBe(false);
  });
});
