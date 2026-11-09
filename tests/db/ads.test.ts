import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createStaff, createSupabaseLikeDb } from "../../scripts/lib/pglite-supabase";

let db: PGlite;
let admin: string, editor: string, owner: string;
let mediaId: string;

const INSERT = `insert into public.ad_slots (name, placement, image_id, destination_url, is_active, starts_at, ends_at)
  values ($1, $2, $3, $4, $5, $6, $7) returning id`;

function insertAd(user: string, name: string, opts: { active?: boolean; starts?: string | null; ends?: string | null; url?: string } = {}) {
  return asRole(db, "authenticated", user, async (tx) => {
    const r = await tx.query<{ id: string }>(INSERT, [
      name,
      "home",
      mediaId,
      opts.url ?? "https://example.com/promo",
      opts.active ?? true,
      opts.starts ?? null,
      opts.ends ?? null,
    ]);
    return r.rows[0]!.id;
  });
}

const visibleNames = (role: "anon" | "authenticated", user: string | null) =>
  asRole(db, role, user, async (tx) => (await tx.query<{ name: string }>("select name from public.ad_slots order by name")).rows.map((r) => r.name));

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  owner = await createStaff(db, "owner@ads.local", "owner");
  admin = await createStaff(db, "admin@ads.local", "administrator");
  editor = await createStaff(db, "editor@ads.local", "editor");
  mediaId = await asRole(db, "authenticated", editor, async (tx) => {
    const r = await tx.query<{ id: string }>(
      "insert into public.media_assets (kind, storage_path, file_name, mime_type, uploaded_by) values ('image', $1, 'ad.png', 'image/png', $2) returning id",
      [`${editor}/${crypto.randomUUID()}-ad.png`, editor],
    );
    return r.rows[0]!.id;
  });
  const hour = 3600 * 1000;
  const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
  await insertAd(admin, "a-live");
  await insertAd(admin, "b-scheduled", { starts: iso(hour) });
  await insertAd(admin, "c-expired", { starts: iso(-2 * hour), ends: iso(-hour) });
  await insertAd(admin, "d-inactive", { active: false });
  await insertAd(owner, "e-live-window", { starts: iso(-hour), ends: iso(hour) });
});

afterAll(async () => {
  await db.close();
});

describe("ad_slots RLS", () => {
  it("grants ads.manage to owner and administrator only", async () => {
    const r = await db.query<{ role: string }>("select role::text from public.role_permissions where permission = 'ads.manage' order by role");
    expect(r.rows.map((x) => x.role)).toEqual(["owner", "administrator"].sort());
  });

  it("anon and staff without ads.manage see only live ads", async () => {
    expect(await visibleNames("anon", null)).toEqual(["a-live", "e-live-window"]);
    expect(await visibleNames("authenticated", editor)).toEqual(["a-live", "e-live-window"]);
  });

  it("ads.manage holders see every ad", async () => {
    expect(await visibleNames("authenticated", admin)).toEqual(["a-live", "b-scheduled", "c-expired", "d-inactive", "e-live-window"]);
  });

  it("staff without ads.manage cannot insert, update or delete", async () => {
    await expect(insertAd(editor, "x-editor")).rejects.toThrow(/row-level security/);
    const upd = await asRole(db, "authenticated", editor, (tx) => tx.query("update public.ad_slots set name = 'hacked' where name = 'a-live'"));
    expect(upd.affectedRows).toBe(0);
    const del = await asRole(db, "authenticated", editor, (tx) => tx.query("delete from public.ad_slots where name = 'a-live'"));
    expect(del.affectedRows).toBe(0);
  });

  it("anon cannot write at all", async () => {
    await expect(
      asRole(db, "anon", null, (tx) => tx.query(INSERT, ["x-anon", "home", mediaId, "https://example.com", true, null, null])),
    ).rejects.toThrow(/permission denied/);
  });

  it("administrator can update and the change is audited", async () => {
    const upd = await asRole(db, "authenticated", admin, (tx) => tx.query("update public.ad_slots set is_active = false where name = 'd-inactive'"));
    expect(upd.affectedRows).toBe(1);
    const audit = await db.query("select 1 from public.audit_logs where entity_type = 'ad_slots' and action = 'update' and actor_id = $1", [admin]);
    expect(audit.rows.length).toBeGreaterThan(0);
  });

  it("rejects non-https destinations and inverted windows", async () => {
    await expect(insertAd(admin, "x-http", { url: "http://example.com" })).rejects.toThrow(/check constraint/);
    await expect(insertAd(admin, "x-js", { url: "javascript:alert(1)" })).rejects.toThrow(/check constraint/);
    await expect(insertAd(admin, "x-window", { starts: "2026-12-02T00:00:00Z", ends: "2026-12-01T00:00:00Z" })).rejects.toThrow(/check constraint/);
  });

  it("counts ad images as media usage and blocks deleting them", async () => {
    const rows = await asRole(db, "authenticated", admin, async (tx) =>
      (await tx.query<{ usage_kind: string; label: string | null }>("select * from public.media_usages($1)", [mediaId])).rows,
    );
    expect(rows.filter((r) => r.usage_kind === "ad_slot")).toHaveLength(5);
    // Editors can see the usage exists but not the ad names.
    const editorRows = await asRole(db, "authenticated", editor, async (tx) =>
      (await tx.query<{ usage_kind: string; label: string | null }>("select * from public.media_usages($1)", [mediaId])).rows,
    );
    expect(editorRows.every((r) => r.usage_kind !== "ad_slot" || r.label === null)).toBe(true);
    await expect(asRole(db, "authenticated", editor, (tx) => tx.query("delete from public.media_assets where id = $1", [mediaId]))).rejects.toThrow(
      /media_in_use/,
    );
  });
});
