import { describe, expect, it } from "vitest";
import { fitDimensions, MAX_EDGE } from "@/lib/client/fit-image";

describe("fitDimensions", () => {
  it("scales a big landscape photo to the long-edge limit, keeping its shape", () => {
    expect(fitDimensions(6000, 4000)).toEqual({ width: MAX_EDGE, height: 1600 });
  });
  it("handles portrait and panorama shapes", () => {
    expect(fitDimensions(3000, 6000)).toEqual({ width: 1200, height: MAX_EDGE });
    expect(fitDimensions(12000, 1000)).toEqual({ width: MAX_EDGE, height: 200 });
  });
  it("never enlarges a small image", () => {
    expect(fitDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
