import { describe, expect, it } from "vitest";
import { adSlotInputSchema, adStatus } from "@/lib/studio/ads";

const now = new Date("2026-11-07T04:00:00Z");

describe("adStatus", () => {
  it("classifies by active flag and window", () => {
    expect(adStatus({ is_active: false, starts_at: null, ends_at: null }, now)).toBe("inactive");
    expect(adStatus({ is_active: true, starts_at: null, ends_at: null }, now)).toBe("live");
    expect(adStatus({ is_active: true, starts_at: "2026-11-08T00:00:00Z", ends_at: null }, now)).toBe("scheduled");
    expect(adStatus({ is_active: true, starts_at: null, ends_at: "2026-11-07T04:00:00Z" }, now)).toBe("expired"); // end is exclusive
    expect(adStatus({ is_active: true, starts_at: "2026-11-07T04:00:00Z", ends_at: "2026-11-07T05:00:00Z" }, now)).toBe("live"); // start inclusive
    expect(adStatus({ is_active: false, starts_at: null, ends_at: "2026-01-01T00:00:00Z" }, now)).toBe("inactive");
  });
});

describe("adSlotInputSchema", () => {
  const base = {
    name: " Promo ",
    placement: "home",
    image_id: "6f1c1b0e-1d2a-4b4e-9c55-1b2f3a4d5e6f",
    alt_text: "",
    destination_url: "https://example.com/x",
    is_active: "on",
    starts_at: "2026-11-07T08:00",
    ends_at: "",
    sort_order: "2",
  };

  it("parses form values (Manila times, checkbox, trimming)", () => {
    const v = adSlotInputSchema.parse(base);
    expect(v).toMatchObject({ name: "Promo", alt_text: null, is_active: true, starts_at: "2026-11-07T00:00:00.000Z", ends_at: null, sort_order: 2 });
    expect(adSlotInputSchema.parse({ ...base, is_active: null }).is_active).toBe(false);
  });

  it("rejects unsafe destinations, bad placements and inverted windows", () => {
    expect(adSlotInputSchema.safeParse({ ...base, destination_url: "http://example.com" }).success).toBe(false);
    expect(adSlotInputSchema.safeParse({ ...base, destination_url: "javascript:alert(1)" }).success).toBe(false);
    expect(adSlotInputSchema.safeParse({ ...base, placement: "sidebar" }).success).toBe(false);
    expect(adSlotInputSchema.safeParse({ ...base, image_id: "" }).success).toBe(false);
    expect(adSlotInputSchema.safeParse({ ...base, ends_at: "2026-11-07T07:00" }).success).toBe(false);
  });
});
