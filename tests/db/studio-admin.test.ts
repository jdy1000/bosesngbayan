import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createStaff, createSupabaseLikeDb } from "../../scripts/lib/pglite-supabase";

let db: PGlite;
let owner: string, editor: string, writer: string, analyst: string, outsider: string;

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  owner = await createStaff(db, "owner@studio.local", "owner");
  editor = await createStaff(db, "editor@studio.local", "editor");
  writer = await createStaff(db, "writer@studio.local", "writer");
  analyst = await createStaff(db, "analyst@studio.local", "analyst");
  outsider = await createStaff(db, "reader@studio.local", null);
});

afterAll(async () => {
  await db.close();
});

const directory = (userId: string | null, role: "anon" | "authenticated" = "authenticated") =>
  asRole(db, role, userId, async (tx) => (await tx.query<{ user_id: string; email: string }>("select * from public.staff_directory()")).rows);

describe("staff_directory", () => {
  it("returns staff emails to users.view holders only", async () => {
    const rows = await directory(editor);
    const emails = rows.map((r) => r.email);
    expect(emails).toEqual(expect.arrayContaining(["owner@studio.local", "editor@studio.local", "writer@studio.local"]));
    // Accounts without a role are not staff and never listed.
    expect(emails).not.toContain("reader@studio.local");
    expect((await directory(owner)).length).toBe(rows.length);
  });

  it("returns nothing for staff without users.view or non-staff accounts", async () => {
    expect(await directory(writer)).toEqual([]);
    expect(await directory(analyst)).toEqual([]);
    expect(await directory(outsider)).toEqual([]);
  });

  it("is not executable by anon", async () => {
    await expect(directory(null, "anon")).rejects.toThrow(/permission denied/);
  });

  it("hides deactivated callers", async () => {
    await asRole(db, "authenticated", owner, (tx) => tx.query("select public.set_user_active($1, false)", [editor]));
    expect(await directory(editor)).toEqual([]);
    await asRole(db, "authenticated", owner, (tx) => tx.query("select public.set_user_active($1, true)", [editor]));
  });
});

describe("site_settings write policy", () => {
  const upsert = (userId: string, key: string) =>
    asRole(db, "authenticated", userId, (tx) =>
      tx.query("insert into public.site_settings (key, value) values ($1, '{}'::jsonb) on conflict (key) do update set value = excluded.value", [key]),
    );

  it("seo.manage may write only the seo key; settings.manage writes any key", async () => {
    await expect(upsert(analyst, "seo")).rejects.toThrow();
    await asRole(db, "authenticated", owner, (tx) => tx.query("select public.set_role_permission('analyst', 'seo.manage', true)"));
    await expect(upsert(analyst, "seo")).resolves.toBeTruthy();
    await expect(upsert(analyst, "general")).rejects.toThrow();
    await expect(upsert(owner, "general")).resolves.toBeTruthy();
    await asRole(db, "authenticated", owner, (tx) => tx.query("select public.set_role_permission('analyst', 'seo.manage', false)"));
  });
});
