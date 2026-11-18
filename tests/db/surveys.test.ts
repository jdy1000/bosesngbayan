import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createStaff, createSupabaseLikeDb } from "../../scripts/lib/pglite-supabase";

let db: PGlite;
let owner: string, admin: string, editor: string, writer: string, moderator: string, analyst: string;
let mediaId: string;
let liveId: string, draftId: string;

const insertSurvey = (user: string, title: string, published: boolean, homepage = true) =>
  asRole(db, "authenticated", user, async (tx) => {
    const r = await tx.query<{ id: string }>(
      "insert into public.surveys (title, is_published, show_on_homepage, survey_date, created_by) values ($1, $2, $3, '2026-11-11', auth.uid()) returning id",
      [title, published, homepage],
    );
    return r.rows[0]!.id;
  });

const insertEntry = (user: string, surveyId: string, name: string, photo: string | null = null) =>
  asRole(db, "authenticated", user, async (tx) => {
    const r = await tx.query<{ id: string }>(
      "insert into public.survey_entries (survey_id, name, rank_no, overall_pct, trust_pct, performance_pct, photo_id, position) values ($1, $2, 1, 87.3, 86.7, 87.9, $3, 0) returning id",
      [surveyId, name, photo],
    );
    return r.rows[0]!.id;
  });

const visible = (role: "anon" | "authenticated", user: string | null, table: "surveys" | "survey_entries") =>
  asRole(db, role, user, async (tx) => (await tx.query<{ n: number }>(`select count(*)::int n from public.${table}`)).rows[0]!.n);

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  owner = await createStaff(db, "owner@surveys.local", "owner");
  admin = await createStaff(db, "admin@surveys.local", "administrator");
  editor = await createStaff(db, "editor@surveys.local", "editor");
  writer = await createStaff(db, "writer@surveys.local", "writer");
  moderator = await createStaff(db, "mod@surveys.local", "moderator");
  analyst = await createStaff(db, "analyst@surveys.local", "analyst");
  mediaId = await asRole(db, "authenticated", editor, async (tx) => {
    const r = await tx.query<{ id: string }>(
      "insert into public.media_assets (kind, storage_path, file_name, mime_type, uploaded_by) values ('image', $1, 'face.jpg', 'image/jpeg', $2) returning id",
      [`${editor}/${crypto.randomUUID()}-face.jpg`, editor],
    );
    return r.rows[0]!.id;
  });
  liveId = await insertSurvey(editor, "Live survey", true);
  draftId = await insertSurvey(writer, "Draft survey", false);
  await insertEntry(editor, liveId, "Live candidate", mediaId);
  await insertEntry(writer, draftId, "Draft candidate");
});

afterAll(async () => {
  await db.close();
});

describe("surveys.manage permission", () => {
  it("goes to owner, administrator, editor and writer only", async () => {
    const r = await db.query<{ role: string }>("select role::text from public.role_permissions where permission = 'surveys.manage' order by role");
    expect(r.rows.map((x) => x.role).sort()).toEqual(["administrator", "editor", "owner", "writer"]);
  });
});

describe("surveys RLS", () => {
  it("the public sees only published surveys and their candidates", async () => {
    expect(await visible("anon", null, "surveys")).toBe(1);
    expect(await visible("anon", null, "survey_entries")).toBe(1);
  });

  it("owner, administrator, editor and writer see drafts too", async () => {
    for (const user of [owner, admin, editor, writer]) {
      expect(await visible("authenticated", user, "surveys")).toBe(2);
      expect(await visible("authenticated", user, "survey_entries")).toBe(2);
    }
  });

  it("a moderator and an analyst read only what the public reads", async () => {
    for (const user of [moderator, analyst]) {
      expect(await visible("authenticated", user, "surveys")).toBe(1);
      expect(await visible("authenticated", user, "survey_entries")).toBe(1);
    }
  });

  it("only surveys.manage holders can write; the public and other staff cannot", async () => {
    await expect(insertSurvey(moderator, "nope", true)).rejects.toThrow();
    await expect(insertSurvey(analyst, "nope", true)).rejects.toThrow();
    await expect(insertEntry(moderator, liveId, "nope")).rejects.toThrow();
    await expect(asRole(db, "anon", null, (tx) => tx.query("insert into public.surveys (title) values ('anon')"))).rejects.toThrow();
    const upd = await asRole(db, "authenticated", analyst, (tx) => tx.query("update public.surveys set title = 'hacked' where id = $1", [liveId]));
    expect(upd.affectedRows ?? 0).toBe(0);
    const del = await asRole(db, "authenticated", moderator, (tx) => tx.query("delete from public.survey_entries where survey_id = $1", [liveId]));
    expect(del.affectedRows ?? 0).toBe(0);
  });

  it("a writer can create, edit and publish any survey (the client wants authors to manage the section)", async () => {
    const id = await insertSurvey(writer, "Writer survey", false);
    await asRole(db, "authenticated", writer, (tx) => tx.query("update public.surveys set is_published = true where id = $1", [id]));
    expect(await visible("anon", null, "surveys")).toBe(2);
    await asRole(db, "authenticated", writer, (tx) => tx.query("update public.surveys set title = 'Edited by a writer' where id = $1", [liveId]));
    await asRole(db, "authenticated", writer, (tx) => tx.query("update public.surveys set title = 'Live survey' where id = $1", [liveId]));
    await asRole(db, "authenticated", writer, (tx) => tx.query("delete from public.surveys where id = $1", [id]));
    expect(await visible("anon", null, "surveys")).toBe(1);
  });

  it("deleting a whole survey is for its creator and for editors and above", async () => {
    const mine = await insertSurvey(editor, "Editor survey to delete", true);
    const del = await asRole(db, "authenticated", writer, (tx) => tx.query("delete from public.surveys where id = $1", [mine]));
    expect(del.affectedRows ?? 0).toBe(0);
    const ok = await asRole(db, "authenticated", admin, (tx) => tx.query("delete from public.surveys where id = $1", [mine]));
    expect(ok.affectedRows).toBe(1);
  });

  it("unpublishing hides the candidates from the public at once", async () => {
    const id = await insertSurvey(editor, "Toggle survey", true);
    await insertEntry(editor, id, "Toggle candidate");
    expect(await visible("anon", null, "survey_entries")).toBe(2);
    await asRole(db, "authenticated", editor, (tx) => tx.query("update public.surveys set is_published = false where id = $1", [id]));
    expect(await visible("anon", null, "survey_entries")).toBe(1);
  });
});

describe("surveys data rules", () => {
  it("rejects percentages outside 0-100, a blank name and a rank of 0", async () => {
    const bad = (cols: string, vals: unknown[]) =>
      asRole(db, "authenticated", editor, (tx) => tx.query(`insert into public.survey_entries (survey_id, name, ${cols}) values ($1, 'x', ${vals.map((_, i) => `$${i + 2}`).join(", ")})`, [liveId, ...vals]));
    await expect(bad("overall_pct", [100.1])).rejects.toThrow();
    await expect(bad("trust_pct", [-1])).rejects.toThrow();
    await expect(bad("rank_no", [0])).rejects.toThrow();
    await expect(asRole(db, "authenticated", editor, (tx) => tx.query("insert into public.survey_entries (survey_id, name) values ($1, '   ')", [liveId]))).rejects.toThrow();
  });

  it("candidate photos start at the original framing and accept only a position the card can show", async () => {
    const id = await asRole(db, "authenticated", editor, async (tx) => {
      const r = await tx.query<{ id: string }>("insert into public.survey_entries (survey_id, name) values ($1, 'framing') returning id", [liveId]);
      return r.rows[0]!.id;
    });
    const row = await db.query<{ photo_x: number; photo_y: number; photo_zoom: number }>("select photo_x, photo_y, photo_zoom from public.survey_entries where id = $1", [id]);
    expect(row.rows[0]).toEqual({ photo_x: 50, photo_y: 0, photo_zoom: 100 });
    await asRole(db, "authenticated", editor, (tx) => tx.query("update public.survey_entries set photo_x = 20, photo_y = 100, photo_zoom = 300 where id = $1", [id]));
    for (const set of ["photo_x = 101", "photo_y = -1", "photo_zoom = 99", "photo_zoom = 301"]) {
      await expect(asRole(db, "authenticated", editor, (tx) => tx.query(`update public.survey_entries set ${set} where id = $1`, [id])), set).rejects.toThrow();
    }
  });

  it("stores one decimal place", async () => {
    const id = await asRole(db, "authenticated", editor, async (tx) => {
      const r = await tx.query<{ overall_pct: string }>("insert into public.survey_entries (survey_id, name, overall_pct) values ($1, 'dec', 75.84) returning overall_pct", [liveId]);
      return r.rows[0]!.overall_pct;
    });
    expect(Number(id)).toBe(75.8);
  });

  it("deleting a survey deletes its candidates", async () => {
    const id = await insertSurvey(editor, "Cascade", true);
    await insertEntry(editor, id, "Cascade candidate");
    await asRole(db, "authenticated", editor, (tx) => tx.query("delete from public.surveys where id = $1", [id]));
    const left = await db.query<{ n: number }>("select count(*)::int n from public.survey_entries where survey_id = $1", [id]);
    expect(left.rows[0]!.n).toBe(0);
  });
});

describe("candidate photos", () => {
  it("cannot be deleted from the media library while a candidate uses them", async () => {
    await expect(db.query("delete from public.media_assets where id = $1", [mediaId])).rejects.toThrow(/media_in_use/);
  });

  it("are listed by media_usages for staff", async () => {
    const r = await asRole(db, "authenticated", editor, (tx) => tx.query<{ usage_kind: string; label: string; detail: string }>("select usage_kind, label, detail from public.media_usages($1)", [mediaId]));
    expect(r.rows).toContainEqual({ usage_kind: "survey_entry", label: "Live candidate - Live survey", detail: "published survey" });
  });
});

describe("homepage block", () => {
  it("the surveys block sits right after the top stories in the draft and the published layout", async () => {
    for (const status of ["draft", "published"]) {
      const r = await db.query<{ block_type: string }>(
        `select s.block_type from public.homepage_sections s join public.homepage_configurations c on c.id = s.configuration_id where c.status = $1 order by s.position`,
        [status],
      );
      const types = r.rows.map((x) => x.block_type);
      expect(types.indexOf("surveys"), status).toBe(types.indexOf("top_stories") + 1);
    }
  });

  it("its stored settings parse with the block schema", async () => {
    const { parseSection } = await import("@/lib/homepage/blocks");
    const row = (await db.query<{ settings: unknown; title: string | null }>("select settings, title from public.homepage_sections where block_type = 'surveys' limit 1")).rows[0]!;
    expect(parseSection({ id: "x", block_type: "surveys", title: row.title, description: null, settings: row.settings }).issues).toEqual([]);
  });
});

describe("About page heading", () => {
  it("no longer starts with “Tungkol sa”", async () => {
    const r = await db.query<{ title: string }>("select title from public.pages where slug = 'tungkol'");
    expect(r.rows[0]?.title).toBe("Boses ng Bayan");
  });
});
