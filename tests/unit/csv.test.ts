import { describe, expect, test } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/studio/csv";
import { moveId, positionUpdates } from "@/lib/studio/reorder";

describe("escapeCsvCell", () => {
  test("neutralises formula-leading cells", () => {
    expect(escapeCsvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(escapeCsvCell("+63 912")).toBe("'+63 912");
    expect(escapeCsvCell("-1")).toBe("'-1");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("\tcmd")).toBe("'\tcmd");
  });

  test("quotes commas, quotes and newlines", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('sabi niya "oo"')).toBe('"sabi niya ""oo"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  test("renders empty and non-string values", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(true)).toBe("true");
    expect(escapeCsvCell("Pañero")).toBe("Pañero");
  });

  test("toCsv adds BOM, header and CRLF rows", () => {
    expect(toCsv(["a", "b"], [["1", "=2"]])).toBe("﻿a,b\r\n1,'=2\r\n");
  });
});

describe("reorder helpers", () => {
  test("moveId swaps neighbours and ignores edges", () => {
    expect(moveId(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
    expect(moveId(["a", "b"], "a", "up")).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "x", "up")).toEqual(["a", "b"]);
  });

  test("positionUpdates only returns changed rows", () => {
    const rows = [
      { id: "a", position: 0 },
      { id: "b", position: 10 },
      { id: "c", position: 20 },
    ];
    expect(positionUpdates(rows, ["b", "a", "c"])).toEqual([
      { id: "b", position: 0 },
      { id: "a", position: 10 },
    ]);
  });
});
