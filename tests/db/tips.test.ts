import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createStaff, createSupabaseLikeDb } from "../../scripts/lib/pglite-supabase";

let db: PGlite;
let owner: string, administrator: string, editor: string, writer: string, moderator: string, analyst: string, outsider: string;

const DETAILS = "The barangay hall paid for a road that was never built. I saw the documents at the office.";
const submit = (subject: string, urls: string[] = []) =>
  asRole(db, "service_role", null, (tx) =>
    tx.query("select public.submit_tip($1, $2, ' DPWH ', '', $3::text[], '', 'juan@example.test')", [subject, DETAILS, urls]),
  );
const idFor = async (subject: string) => (await db.query<{ id: string }>("select id from public.tips where subject = $1", [subject])).rows[0]!.id;
const select = (userId: string | null, role: "anon" | "authenticated" = "authenticated") =>
  asRole(db, role, userId, async (tx) => (await tx.query("select id from public.tips")).rows);
const versionOf = async (id: string) =>
  (await db.query<{ updated_at: string }>("select updated_at::text from public.tips where id = $1", [id])).rows[0]!.updated_at;
// Reviews against the tip's current version, as Studio does when the form is fresh.
const review = async (userId: string, id: string, status: string, note: string | null = null, version?: string) => {
  const expected = version ?? (await versionOf(id));
  return asRole(db, "authenticated", userId, (tx) => tx.query("select public.review_tip($1, $2, $3, $4::timestamptz)", [id, status, note, expected]));
};

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  owner = await createStaff(db, "owner@studio.local", "owner");
  administrator = await createStaff(db, "admin@studio.local", "administrator");
  editor = await createStaff(db, "editor@studio.local", "editor");
  writer = await createStaff(db, "writer@studio.local", "writer");
  moderator = await createStaff(db, "moderator@studio.local", "moderator");
  analyst = await createStaff(db, "analyst@studio.local", "analyst");
  outsider = await createStaff(db, "reader@studio.local", null);
  await submit("Ghost road project", ["https://example.test/doc.pdf"]);
});

afterAll(async () => {
  await db.close();
});

describe("tip submission", () => {
  it("is service-role only: anon and signed-in users cannot call the RPC or insert directly", async () => {
    const call = "select public.submit_tip('Subject here', repeat('x', 40), '', '', '{}', '', '')";
    await expect(asRole(db, "anon", null, (tx) => tx.query(call))).rejects.toThrow(/permission denied/);
    await expect(asRole(db, "authenticated", owner, (tx) => tx.query(call))).rejects.toThrow(/permission denied/);
    for (const [role, user] of [["anon", null], ["authenticated", writer], ["authenticated", owner]] as const) {
      await expect(
        asRole(db, role, user, (tx) => tx.query("insert into public.tips (subject, details) values ('Subject here', repeat('x', 40))")),
      ).rejects.toThrow();
    }
  });

  it("trims optional text, stores empty fields as null and keeps no network data", async () => {
    const row = (await db.query<Record<string, unknown>>("select * from public.tips where subject = 'Ghost road project'")).rows[0]!;
    expect(row).toMatchObject({ agency: "DPWH", location: null, contact_name: null, contact: "juan@example.test", status: "new" });
    expect(Object.keys(row).some((k) => /hash|ip/.test(k))).toBe(false);
  });

  it("refuses evidence links that are not https and more than five links", async () => {
    await expect(submit("Bad link one", ["http://example.test/a"])).rejects.toThrow(/invalid_evidence_url/);
    await expect(submit("Bad link two", ["javascript:alert(1)"])).rejects.toThrow(/invalid_evidence_url/);
    await expect(submit("Too many links", Array.from({ length: 6 }, (_, i) => `https://example.test/${i}`))).rejects.toThrow();
  });
});

describe("tip access", () => {
  it("only tips.manage holders (owner, administrator, editor) can read tips", async () => {
    for (const user of [owner, administrator, editor]) expect((await select(user)).length).toBeGreaterThan(0);
    for (const user of [writer, moderator, analyst, outsider]) expect(await select(user)).toEqual([]);
    await expect(select(null, "anon")).rejects.toThrow(/permission denied/);
  });

  it("no one updates or deletes rows directly", async () => {
    const id = await idFor("Ghost road project");
    for (const user of [owner, editor]) {
      await expect(
        asRole(db, "authenticated", user, (tx) => tx.query("update public.tips set status = 'verified', reviewed_at = now() where id = $1", [id])),
      ).rejects.toThrow(/permission denied/);
      await expect(asRole(db, "authenticated", user, (tx) => tx.query("delete from public.tips where id = $1", [id]))).rejects.toThrow(/permission denied/);
    }
  });
});

describe("review_tip", () => {
  it("denies callers without tips.manage", async () => {
    const id = await idFor("Ghost road project");
    for (const user of [writer, moderator, analyst, outsider]) await expect(review(user, id, "reviewing")).rejects.toThrow(/not_authorized/);
  });

  it("allows only known statuses and requires a note to dismiss", async () => {
    const id = await idFor("Ghost road project");
    await expect(review(editor, id, "new")).rejects.toThrow(/invalid_transition/);
    await expect(review(editor, id, "published")).rejects.toThrow(/invalid_transition/);
    await expect(review(editor, id, "dismissed", "  ")).rejects.toThrow(/dismissal_reason_required/);
  });

  it("records the reviewer and audits only the statuses, never the tip's content", async () => {
    const id = await idFor("Ghost road project");
    await review(editor, id, "reviewing", "Calling the barangay office");
    await review(editor, id, "verified", "Confirmed with two documents");
    const row = (await db.query<{ status: string; reviewed_by: string; staff_note: string }>("select * from public.tips where id = $1", [id])).rows[0]!;
    expect(row).toMatchObject({ status: "verified", reviewed_by: editor, staff_note: "Confirmed with two documents" });
    const audit = await db.query<{ actor_id: string; details: Record<string, unknown> }>(
      "select actor_id, details from public.audit_logs where entity_type = 'tips' and entity_id = $1 order by created_at",
      [id],
    );
    expect(audit.rows.map((r) => r.details)).toEqual([{ from: "new", to: "reviewing" }, { from: "reviewing", to: "verified" }]);
    expect(JSON.stringify(audit.rows)).not.toMatch(/Ghost|barangay|example\.test|documents/);
  });

  it("refuses a change made from a stale form instead of overwriting the newer one", async () => {
    await submit("Two editors at once");
    const id = await idFor("Two editors at once");
    const opened = await versionOf(id); // both editors open the tip
    await review(editor, id, "reviewing", "First editor's note", opened);
    const stale = await review(administrator, id, "dismissed", "Second editor's note", opened).then(
      () => null,
      (e: { code?: string; message?: string }) => e,
    );
    expect(stale?.message).toMatch(/tip_changed/);
    // Not 40001 (serialization_failure): PostgREST retries that, so a stale form would never get an answer.
    expect(stale?.code).toBe("22023");
    const row = (await db.query<{ status: string; staff_note: string }>("select status, staff_note from public.tips where id = $1", [id])).rows[0]!;
    expect(row).toEqual({ status: "reviewing", staff_note: "First editor's note" });
    await db.query("delete from public.tips where id = $1", [id]);
  });
});

describe("purge_old_tips", () => {
  it("is service-only and deletes only tips dismissed more than 180 days ago", async () => {
    await submit("Old dismissed tip");
    await submit("Recent dismissed tip");
    await review(owner, await idFor("Old dismissed tip"), "dismissed", "Duplicate");
    await review(owner, await idFor("Recent dismissed tip"), "dismissed", "No evidence");
    await db.query("update public.tips set reviewed_at = now() - interval '181 days' where subject = 'Old dismissed tip'");
    await expect(asRole(db, "authenticated", owner, (tx) => tx.query("select public.purge_old_tips()"))).rejects.toThrow(/permission denied/);
    const n = await asRole(db, "service_role", null, async (tx) => (await tx.query<{ purge_old_tips: number }>("select public.purge_old_tips()")).rows[0]!.purge_old_tips);
    expect(n).toBe(1);
    const left = (await db.query<{ subject: string }>("select subject from public.tips order by subject")).rows.map((r) => r.subject);
    expect(left).toEqual(["Ghost road project", "Recent dismissed tip"]);
  });
});

describe("tip line navigation", () => {
  it("seeds header and footer links to /mag-ulat", async () => {
    const rows = await db.query<{ key: string }>(
      "select m.key from public.navigation_items i join public.navigation_menus m on m.id = i.menu_id where i.href = '/mag-ulat' order by m.key",
    );
    expect(rows.rows.map((r) => r.key)).toEqual(["footer_main", "header"]);
  });
});
