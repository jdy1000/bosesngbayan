import { describe, expect, it } from "vitest";
import { fillDays, parseRange } from "@/lib/studio/range";

// 2026-11-06 02:00 Manila = 2026-11-05T18:00Z
const now = new Date("2026-11-05T18:00:00Z");

describe("parseRange", () => {
  it("uses Manila calendar days for presets", () => {
    const today = parseRange({ range: "today" }, "7d", now);
    expect(today.fromDate).toBe("2026-11-06");
    expect(today.fromIso).toBe("2026-11-05T16:00:00.000Z");
    expect(today.toIso).toBe("2026-11-06T16:00:00.000Z");
    const week = parseRange({}, "7d", now);
    expect(week.fromDate).toBe("2026-10-31");
    expect(week.days).toHaveLength(7);
  });

  it("accepts a valid custom range and rejects bad ones with a fallback", () => {
    const ok = parseRange({ range: "custom", from: "2026-10-01", to: "2026-10-31" }, "30d", now);
    expect(ok.preset).toBe("custom");
    expect(ok.days).toHaveLength(31);
    expect(parseRange({ range: "custom", from: "2026-10-31", to: "2026-10-01" }, "7d", now).error).toBeTruthy();
    expect(parseRange({ range: "custom", from: "2026-02-30", to: "2026-03-01" }, "7d", now).error).toBeTruthy();
    expect(parseRange({ range: "custom", from: "2026-11-01", to: "2026-11-09" }, "7d", now).error).toBeTruthy();
    expect(parseRange({ range: "custom", from: "2024-01-01", to: "2026-11-01" }, "7d", now).error).toBeTruthy();
  });

  it("zero-fills missing days", () => {
    const filled = fillDays(["2026-11-01", "2026-11-02"], [{ day: "2026-11-02", views: 5 }], ["views"]);
    expect(filled).toEqual([
      { day: "2026-11-01", views: 0 },
      { day: "2026-11-02", views: 5 },
    ]);
  });
});

