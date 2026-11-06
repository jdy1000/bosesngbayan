import { describe, expect, it } from "vitest";
import { newPasswordSchema } from "@/lib/auth/password";

const check = (password: string, confirm = password) => newPasswordSchema.safeParse({ password, confirm });

describe("newPasswordSchema (mirrors Supabase Auth policy)", () => {
  it("accepts 12+ chars with lower, upper and digit", () => {
    expect(check("Bagong-Pass-2026x").success).toBe(true);
  });

  it.each([
    ["too short", "Short1abcde"],
    ["no uppercase", "lowercase-only-123"],
    ["no lowercase", "UPPERCASE-ONLY-123"],
    ["no digit", "No-Digits-Here-At-All"],
  ])("rejects %s", (_label, pw) => {
    expect(check(pw).success).toBe(false);
  });

  it("rejects a confirmation that does not match", () => {
    const r = check("Bagong-Pass-2026x", "Bagong-Pass-2026y");
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});
