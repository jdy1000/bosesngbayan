import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createStaff, createSupabaseLikeDb } from "../../scripts/lib/pglite-supabase";

let db: PGlite;
let owner: string, administrator: string, editor: string, writer: string, outsider: string;

const submit = (email: string, role = "writer") =>
  asRole(db, "service_role", null, (tx) =>
    tx.query("select public.submit_publisher_application('Juan Dela Cruz', $1, $2::public.app_role, '', '', 'I want to write about my barangay.', 'nethash')", [email, role]),
  );
const idFor = async (email: string) =>
  (await db.query<{ id: string }>("select id from public.publisher_applications where email = $1 order by created_at desc limit 1", [email])).rows[0]!.id;
const select = (userId: string | null, role: "anon" | "authenticated" = "authenticated") =>
  asRole(db, role, userId, async (tx) => (await tx.query("select id from public.publisher_applications")).rows);
const review = (userId: string, id: string, decision: string, note: string | null = null, role: string | null = null) =>
  asRole(db, "authenticated", userId, (tx) =>
    tx.query("select public.review_publisher_application($1, $2, $3, $4::public.app_role, null)", [id, decision, note, role]),
  );

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  owner = await createStaff(db, "owner@studio.local", "owner");
  administrator = await createStaff(db, "admin@studio.local", "administrator");
  editor = await createStaff(db, "editor@studio.local", "editor");
  writer = await createStaff(db, "writer@studio.local", "writer");
  outsider = await createStaff(db, "reader@studio.local", null);
  await submit("first@example.test");
});

afterAll(async () => {
  await db.close();
});

describe("publisher_applications submission", () => {
  it("is service-role only: anon and authenticated cannot call the RPC or insert directly", async () => {
    await expect(
      asRole(db, "anon", null, (tx) => tx.query("select public.submit_publisher_application('A B', 'x@example.test', 'writer', '', '', 'msg', null)")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(db, "authenticated", writer, (tx) => tx.query("select public.submit_publisher_application('A B', 'x@example.test', 'writer', '', '', 'msg', null)")),
    ).rejects.toThrow(/permission denied/);
    for (const [role, user] of [["anon", null], ["authenticated", writer], ["authenticated", owner]] as const) {
      await expect(
        asRole(db, role, user, (tx) => tx.query("insert into public.publisher_applications (full_name, email, message) values ('A B', 'y@example.test', 'hello')")),
      ).rejects.toThrow();
    }
  });

  it("keeps one pending application per email and ignores duplicates silently", async () => {
    await submit("FIRST@example.test");
    const rows = await db.query("select 1 from public.publisher_applications where email = 'first@example.test'");
    expect(rows.rows).toHaveLength(1);
  });

  it("rejects privileged roles and non-https links at the database", async () => {
    await expect(submit("boss@example.test", "administrator")).rejects.toThrow();
    await expect(
      asRole(db, "service_role", null, (tx) =>
        tx.query("select public.submit_publisher_application('A B', 'link@example.test', 'writer', '', 'http://x.test', 'msg', null)"),
      ),
    ).rejects.toThrow();
  });
});

describe("publisher_applications access", () => {
  it("users.manage holders can read; everyone else sees nothing", async () => {
    expect((await select(owner)).length).toBeGreaterThan(0);
    expect((await select(administrator)).length).toBeGreaterThan(0);
    expect(await select(editor)).toEqual([]);
    expect(await select(writer)).toEqual([]);
    expect(await select(outsider)).toEqual([]);
    await expect(select(null, "anon")).rejects.toThrow(/permission denied/);
  });

  it("no one updates rows directly; decisions go through the audited RPC", async () => {
    const id = await idFor("first@example.test");
    const update = (user: string) =>
      asRole(db, "authenticated", user, (tx) => tx.query("update public.publisher_applications set status = 'approved', reviewed_at = now() where id = $1", [id]));
    for (const user of [editor, writer, administrator]) await expect(update(user)).rejects.toThrow(/permission denied/);
  });
});

describe("review_publisher_application", () => {
  it("denies callers without users.manage", async () => {
    const id = await idFor("first@example.test");
    await expect(review(editor, id, "approved", null, "writer")).rejects.toThrow(/not_authorized/);
    await expect(review(outsider, id, "rejected", "no")).rejects.toThrow(/not_authorized/);
  });

  it("requires a reason to reject and never grants privileged roles", async () => {
    const id = await idFor("first@example.test");
    await expect(review(owner, id, "rejected", "  ")).rejects.toThrow(/rejection_reason_required/);
    await expect(review(owner, id, "approved", null, "administrator")).rejects.toThrow(/invalid_application_role/);
    await expect(review(owner, id, "deleted")).rejects.toThrow(/invalid_transition/);
  });

  it("rejects once, records reviewer and audit, and blocks a second decision", async () => {
    const id = await idFor("first@example.test");
    await review(administrator, id, "rejected", "Not hiring right now");
    const row = (await db.query<{ status: string; reviewed_by: string; review_note: string }>("select * from public.publisher_applications where id = $1", [id])).rows[0]!;
    expect(row).toMatchObject({ status: "rejected", reviewed_by: administrator, review_note: "Not hiring right now" });
    await expect(review(owner, id, "approved", null, "writer")).rejects.toThrow(/application_already_reviewed/);
    const audit = await db.query<{ actor_id: string; details: Record<string, unknown> }>(
      "select actor_id, details from public.audit_logs where entity_type = 'publisher_applications' and entity_id = $1 and action = 'reject_application'",
      [id],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]!.actor_id).toBe(administrator);
    expect(JSON.stringify(audit.rows[0]!.details)).not.toMatch(/example\.test|Juan/); // no personal data in the audit trail
  });

  it("approves with the granted role in the audit trail; a rejected applicant may apply again", async () => {
    await submit("first@example.test");
    const id = await idFor("first@example.test");
    await review(owner, id, "approved", null, "moderator");
    const audit = await db.query<{ details: { role?: string } }>("select details from public.audit_logs where entity_id = $1 and action = 'approve_application'", [id]);
    expect(audit.rows[0]!.details.role).toBe("moderator");
  });

  it("retention purge is service-only and removes old reviewed applications", async () => {
    await expect(asRole(db, "authenticated", owner, (tx) => tx.query("select public.purge_old_publisher_applications()"))).rejects.toThrow();
    await db.query("update public.publisher_applications set reviewed_at = now() - interval '181 days' where status <> 'pending'");
    const n = await asRole(db, "service_role", null, async (tx) => (await tx.query<{ n: number }>("select public.purge_old_publisher_applications() as n")).rows[0]!.n);
    expect(n).toBe(2);
    expect((await db.query("select 1 from public.publisher_applications where status <> 'pending'")).rows).toEqual([]);
  });
});
