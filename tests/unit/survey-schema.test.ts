import { describe, expect, it } from "vitest";
import { surveyEntryInputSchema } from "@/lib/studio/surveys";
import { PHOTO_DEFAULTS, photoStyle } from "@/lib/survey-photo";

const base = { name: "Kid Peña", area: "Makati City", rank_no: "1", overall_pct: "87.3", trust_pct: "86.7", performance_pct: "87.9", photo_id: "" };

describe("surveyEntryInputSchema photo position", () => {
  it("takes the original framing (centred, from the top, no zoom) when the fields are missing or blank", () => {
    for (const extra of [{}, { photo_x: "", photo_y: " ", photo_zoom: "" }, { photo_x: null, photo_y: null, photo_zoom: null }]) {
      const r = surveyEntryInputSchema.parse({ ...base, ...extra });
      expect({ x: r.photo_x, y: r.photo_y, zoom: r.photo_zoom }).toEqual(PHOTO_DEFAULTS);
    }
  });

  it("keeps a position within range and rejects what the database would", () => {
    expect(surveyEntryInputSchema.parse({ ...base, photo_x: "20", photo_y: "100", photo_zoom: "250" })).toMatchObject({ photo_x: 20, photo_y: 100, photo_zoom: 250 });
    for (const bad of [{ photo_x: "101" }, { photo_y: "-1" }, { photo_zoom: "99" }, { photo_zoom: "301" }, { photo_x: "1.5" }, { photo_zoom: "big" }]) {
      expect(surveyEntryInputSchema.safeParse({ ...base, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("photoStyle", () => {
  it("places the photo and zooms around the same point", () => {
    expect(photoStyle({ x: 30, y: 10, zoom: 150 })).toEqual({ objectPosition: "30% 10%", transformOrigin: "30% 10%", transform: "scale(1.5)" });
  });
  it("adds no transform at 100% so the default card is unchanged", () => {
    expect(photoStyle(PHOTO_DEFAULTS).transform).toBeUndefined();
  });
});
