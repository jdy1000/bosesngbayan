import { describe, expect, it } from "vitest";
import { applicationSchema } from "@/lib/studio/applications";

const valid = {
  full_name: "  Maria Clara  ",
  email: "Maria@Example.TEST ",
  requested_role: "writer",
  organization: "",
  portfolio_url: "",
  message: "I have written for my school paper for three years.",
  consent: "on",
};
const without = (key: keyof typeof valid) => Object.fromEntries(Object.entries(valid).filter(([k]) => k !== key));

describe("publisher application schema", () => {
  it("accepts a valid application and normalizes it", () => {
    const out = applicationSchema.parse(valid);
    expect(out).toMatchObject({ full_name: "Maria Clara", email: "maria@example.test", requested_role: "writer", organization: null, portfolio_url: null, isBot: false });
  });

  it("defaults the role to writer", () => {
    expect(applicationSchema.parse(without("requested_role")).requested_role).toBe("writer");
  });

  it("allows only writer or moderator", () => {
    expect(applicationSchema.parse({ ...valid, requested_role: "moderator" }).requested_role).toBe("moderator");
    for (const role of ["owner", "administrator", "editor", "analyst", ""]) {
      expect(applicationSchema.safeParse({ ...valid, requested_role: role }).success).toBe(false);
    }
  });

  it("requires consent", () => {
    expect(applicationSchema.safeParse(without("consent")).success).toBe(false);
    expect(applicationSchema.safeParse({ ...valid, consent: "off" }).success).toBe(false);
  });

  it("accepts only https portfolio links", () => {
    expect(applicationSchema.parse({ ...valid, portfolio_url: " https://example.test/clips " }).portfolio_url).toBe("https://example.test/clips");
    for (const url of ["http://example.test", "javascript:alert(1)", "ftp://example.test/x", "not a url"]) {
      expect(applicationSchema.safeParse({ ...valid, portfolio_url: url }).success).toBe(false);
    }
  });

  it("flags a filled honeypot as a bot", () => {
    expect(applicationSchema.parse({ ...valid, website: "spam.example" }).isBot).toBe(true);
    expect(applicationSchema.parse({ ...valid, website: "" }).isBot).toBe(false);
  });

  it("bounds name, email and message", () => {
    expect(applicationSchema.safeParse({ ...valid, full_name: "M" }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...valid, message: "too short" }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...valid, message: "x".repeat(2001) }).success).toBe(false);
  });
});
