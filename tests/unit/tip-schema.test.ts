import { describe, expect, it } from "vitest";
import { tipSchema } from "@/lib/tips";
import { fil } from "@/lib/i18n/messages/tips";

const schema = tipSchema(fil.api);
const valid = {
  subject: "  Ghost road project  ",
  details: "The barangay paid for a road that was never built, according to the posted bid documents.",
  evidence: "",
  agree: true,
};
const issue = (input: object) => schema.safeParse(input).error?.issues[0]?.message;

describe("tip schema", () => {
  it("accepts a minimal anonymous tip and fills optional fields with empty strings", () => {
    expect(schema.parse(valid)).toMatchObject({ subject: "Ghost road project", agency: "", location: "", evidence: [], contactName: "", contact: "" });
  });

  it("splits evidence into links, one per line or space, ignoring blank lines", () => {
    const out = schema.parse({ ...valid, evidence: "https://a.example/x\n\n  https://b.example/y \r\n" });
    expect(out.evidence).toEqual(["https://a.example/x", "https://b.example/y"]);
  });

  it("refuses non-https links and more than five", () => {
    // The last two parse as https URLs but are not written as one; the database check would refuse them too.
    for (const evidence of ["http://a.example", "javascript:alert(1)", "not a link", "ftp://a.example/f", "HTTPS://a.example", "https:a.example"]) {
      expect(issue({ ...valid, evidence })).toBe(fil.api.invalidLinks);
    }
    const six = Array.from({ length: 6 }, (_, i) => `https://a.example/${i}`).join("\n");
    expect(issue({ ...valid, evidence: six })).toBe(fil.api.invalidLinks);
  });

  it("requires a real subject, enough detail and the confirmation", () => {
    expect(issue({ ...valid, subject: "abc" })).toBe(fil.api.subjectTooShort);
    expect(issue({ ...valid, details: "Too short." })).toBe(fil.api.detailsTooShort);
    expect(issue({ ...valid, agree: false })).toBe(fil.api.agreeRequired);
  });
});
