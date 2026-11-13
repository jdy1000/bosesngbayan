import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asRole, createStaff, createSupabaseLikeDb } from "../../scripts/lib/pglite-supabase";

let db: PGlite;
let owner: string, admin: string, editor: string, writer: string, writer2: string, moderator: string, analyst: string;
let categoryId: string;

async function newDraft(as: string, slug: string): Promise<string> {
  return asRole(db, "authenticated", as, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into public.articles (slug, title, author_id, category_id, body_text) values ($1, $2, $3, $4, 'Ilang talata ng balita.') returning id`,
      [slug, `Pamagat ${slug}`, as, categoryId],
    );
    return r.rows[0]!.id;
  });
}

async function transition(as: string, id: string, to: string, note: string | null = null, at: string | null = null) {
  return asRole(db, "authenticated", as, (tx) =>
    tx.query("select status from public.transition_article($1, $2::public.article_status, $3, $4)", [id, to, note, at]),
  );
}

async function statusOf(id: string): Promise<string> {
  return (await db.query<{ status: string }>("select status from public.articles where id = $1", [id])).rows[0]!.status;
}

beforeAll(async () => {
  db = await createSupabaseLikeDb();
  owner = await createStaff(db, "owner@test.local", "owner");
  admin = await createStaff(db, "admin@test.local", "administrator");
  editor = await createStaff(db, "editor@test.local", "editor");
  writer = await createStaff(db, "writer@test.local", "writer");
  writer2 = await createStaff(db, "writer2@test.local", "writer");
  moderator = await createStaff(db, "mod@test.local", "moderator");
  analyst = await createStaff(db, "analyst@test.local", "analyst");
  categoryId = (await db.query<{ id: string }>("select id from public.categories where slug = 'edukasyon'")).rows[0]!.id;
});

afterAll(async () => {
  await db.close();
});

describe("migrations and seed", () => {
  it("apply cleanly and create baseline data", async () => {
    const counts = await db.query<{ c: number; n: number; h: number }>(
      `select (select count(*)::int from public.categories) c, (select count(*)::int from public.navigation_items) n,
              (select count(*)::int from public.homepage_configurations) h`,
    );
    expect(counts.rows[0]).toMatchObject({ c: 17, n: 20, h: 2 }); // 20 = 18 + the two tip-line links (ADR-024)
  });

  it("creates a profile for each new auth user", async () => {
    const r = await db.query<{ display_name: string }>("select display_name from public.profiles where id = $1", [writer]);
    expect(r.rows[0]!.display_name).toBe("writer");
  });
});

describe("article creation and direct-update protection", () => {
  it("writer creates a draft; workflow fields are forced server-side", async () => {
    const id = await asRole(db, "authenticated", writer, async (tx) => {
      const r = await tx.query<{ id: string; status: string; published_at: string | null }>(
        `insert into public.articles (slug, title, author_id, status, published_at, is_featured)
         values ('pilit-publish', 'Sinubukang i-publish', $1, 'published', now(), true) returning id, status, published_at`,
        [writer],
      );
      expect(r.rows[0]!.status).toBe("draft");
      expect(r.rows[0]!.published_at).toBeNull();
      return r.rows[0]!.id;
    });
    const row = await db.query<{ is_featured: boolean; created_by: string }>("select is_featured, created_by from public.articles where id = $1", [id]);
    expect(row.rows[0]).toMatchObject({ is_featured: false, created_by: writer });
  });

  it("writer cannot create an article attributed to someone else", async () => {
    await expect(
      asRole(db, "authenticated", writer, (tx) =>
        tx.query("insert into public.articles (slug, title, author_id) values ('ibang-may-akda', 'X', $1)", [writer2]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("analyst and moderator cannot create articles", async () => {
    for (const who of [analyst, moderator]) {
      await expect(
        asRole(db, "authenticated", who, (tx) => tx.query("insert into public.articles (slug, title, author_id) values ($1, 'X', $2)", [`no-${who.slice(0, 6)}`, who])),
      ).rejects.toThrow(/row-level security/);
    }
  });

  it("status cannot be changed with a direct UPDATE", async () => {
    const id = await newDraft(writer, "direct-status");
    await expect(
      asRole(db, "authenticated", writer, (tx) => tx.query("update public.articles set status = 'published' where id = $1", [id])),
    ).rejects.toThrow(/workflow_fields_protected/);
    await expect(
      asRole(db, "authenticated", editor, (tx) => tx.query("update public.articles set status = 'published' where id = $1", [id])),
    ).rejects.toThrow(/workflow_fields_protected/);
  });

  it("writer cannot set homepage placement flags", async () => {
    const id = await newDraft(writer, "flag-attempt");
    await expect(
      asRole(db, "authenticated", writer, (tx) => tx.query("update public.articles set is_breaking = true where id = $1", [id])),
    ).rejects.toThrow(/placement_requires_publish_permission/);
  });

  it("writer cannot see or edit another writer's draft", async () => {
    const id = await newDraft(writer2, "iba-draft");
    const seen = await asRole(db, "authenticated", writer, (tx) => tx.query("select id from public.articles where id = $1", [id]));
    expect(seen.rows).toHaveLength(0);
    const upd = await asRole(db, "authenticated", writer, (tx) => tx.query("update public.articles set title = 'hacked' where id = $1", [id]));
    expect(upd.affectedRows ?? 0).toBe(0);
  });
});

describe("editorial state machine", () => {
  it("full happy path: draft → review → approved → published", async () => {
    const id = await newDraft(writer, "happy-path");
    await transition(writer, id, "pending_review");
    expect(await statusOf(id)).toBe("pending_review");

    // Writer can no longer edit once submitted.
    const upd = await asRole(db, "authenticated", writer, (tx) => tx.query("update public.articles set title = 'late edit' where id = $1", [id]));
    expect(upd.affectedRows ?? 0).toBe(0);

    await transition(editor, id, "approved", "Maayos");
    await transition(editor, id, "published");
    const row = await db.query<{ status: string; approved_by: string; published_by: string; first_published_at: string | null }>(
      "select status, approved_by, published_by, first_published_at from public.articles where id = $1",
      [id],
    );
    expect(row.rows[0]).toMatchObject({ status: "published", approved_by: editor, published_by: editor });
    expect(row.rows[0]!.first_published_at).not.toBeNull();

    const log = await db.query<{ to_status: string; actor_id: string }>(
      "select to_status, actor_id from public.content_activity_logs where entity_id = $1 order by id",
      [id],
    );
    expect(log.rows.map((r) => r.to_status)).toEqual(["pending_review", "approved", "published"]);
    const revs = await db.query<{ n: number }>("select count(*)::int n from public.article_revisions where article_id = $1", [id]);
    expect(revs.rows[0]!.n).toBeGreaterThanOrEqual(2);
  });

  it("writer cannot approve or publish", async () => {
    const id = await newDraft(writer, "writer-publish");
    await expect(transition(writer, id, "published")).rejects.toThrow(/transition_not_allowed/);
    await transition(writer, id, "pending_review");
    await expect(transition(writer, id, "approved")).rejects.toThrow(/transition_not_allowed/);
  });

  it("writer cannot submit someone else's draft", async () => {
    const id = await newDraft(writer2, "submit-other");
    await expect(transition(writer, id, "pending_review")).rejects.toThrow(/transition_not_allowed/);
  });

  it("rejection requires a reason and returns the story to the author", async () => {
    const id = await newDraft(writer, "reject-me");
    await transition(writer, id, "pending_review");
    await expect(transition(editor, id, "rejected", "  ")).rejects.toThrow(/rejection_reason_required/);
    await transition(editor, id, "rejected", "Kulang sa sources");
    const row = await db.query<{ rejection_reason: string; reviewed_by: string }>("select rejection_reason, reviewed_by from public.articles where id = $1", [id]);
    expect(row.rows[0]).toMatchObject({ rejection_reason: "Kulang sa sources", reviewed_by: editor });
    // Author may edit a rejected story and resubmit.
    const upd = await asRole(db, "authenticated", writer, (tx) => tx.query("update public.articles set title = 'Inayos' where id = $1", [id]));
    expect(upd.affectedRows).toBe(1);
    await transition(writer, id, "pending_review");
    expect(await statusOf(id)).toBe("pending_review");
  });

  it("publishing requires a category and body", async () => {
    const id = await asRole(db, "authenticated", editor, async (tx) =>
      (await tx.query<{ id: string }>("insert into public.articles (slug, title, author_id) values ('walang-laman', 'X', $1) returning id", [editor])).rows[0]!.id,
    );
    await expect(transition(editor, id, "published")).rejects.toThrow(/category_required/);
  });

  it("invalid transitions are refused", async () => {
    const id = await newDraft(editor, "invalid-moves");
    await expect(transition(editor, id, "approved")).rejects.toThrow(/transition_not_allowed/);
    await expect(transition(editor, id, "rejected", "x")).rejects.toThrow(/transition_not_allowed/);
  });

  it("scheduling: future only; hidden until due; scheduler publishes", async () => {
    const id = await newDraft(editor, "naka-iskedyul");
    await expect(transition(editor, id, "scheduled", null, new Date(Date.now() - 60_000).toISOString())).rejects.toThrow(/schedule_must_be_future/);
    const future = new Date(Date.now() + 3_600_000).toISOString();
    await transition(editor, id, "scheduled", null, future);
    const anonSees = await asRole(db, "anon", null, (tx) => tx.query("select id from public.articles where id = $1", [id]));
    expect(anonSees.rows).toHaveLength(0);

    // Make it due, then run the scheduler as the service role.
    await db.query("update public.articles set published_at = now() - interval '1 minute' where id = $1", [id]);
    const anonNow = await asRole(db, "anon", null, (tx) => tx.query("select id from public.articles where id = $1", [id]));
    expect(anonNow.rows).toHaveLength(1);
    const n = await asRole(db, "service_role", null, (tx) => tx.query<{ n: number }>("select public.publish_due_articles() as n"));
    expect(n.rows[0]!.n).toBeGreaterThanOrEqual(1);
    expect(await statusOf(id)).toBe("published");
  });

  it("scheduler cannot be triggered by staff", async () => {
    await expect(asRole(db, "authenticated", owner, (tx) => tx.query("select public.publish_due_articles()"))).rejects.toThrow(/permission denied|not_authorized/);
  });

  it("unpublish, archive and restore", async () => {
    const id = await newDraft(editor, "lifecycle");
    await transition(editor, id, "published");
    await transition(editor, id, "draft"); // unpublish
    const anon = await asRole(db, "anon", null, (tx) => tx.query("select id from public.articles where id = $1", [id]));
    expect(anon.rows).toHaveLength(0);
    await transition(editor, id, "archived");
    await transition(editor, id, "draft"); // restore
    expect(await statusOf(id)).toBe("draft");
    await expect(transition(writer, id, "archived")).rejects.toThrow(/transition_not_allowed/);
  });

  it("only owner/administrator can delete; delete is audited", async () => {
    const id = await newDraft(editor, "burahin");
    const ed = await asRole(db, "authenticated", editor, (tx) => tx.query("delete from public.articles where id = $1", [id]));
    expect(ed.affectedRows ?? 0).toBe(0);
    const ad = await asRole(db, "authenticated", admin, (tx) => tx.query("delete from public.articles where id = $1", [id]));
    expect(ad.affectedRows).toBe(1);
    const audit = await db.query("select 1 from public.audit_logs where entity_type = 'articles' and entity_id = $1 and action = 'delete'", [id]);
    expect(audit.rows).toHaveLength(1);
  });
});

describe("public visibility", () => {
  it("anon sees only published content", async () => {
    const draft = await newDraft(writer, "anon-draft");
    const anon = await asRole(db, "anon", null, (tx) => tx.query<{ status: string }>("select status from public.articles"));
    expect(anon.rows.every((r) => r.status === "published" || r.status === "scheduled")).toBe(true);
    const sees = await asRole(db, "anon", null, (tx) => tx.query("select id from public.articles where id = $1", [draft]));
    expect(sees.rows).toHaveLength(0);
  });

  it("anon cannot read revisions, audit logs or activity logs", async () => {
    for (const t of ["article_revisions", "audit_logs", "content_activity_logs"]) {
      const r = await asRole(db, "anon", null, (tx) => tx.query(`select 1 from public.${t}`));
      expect(r.rows).toHaveLength(0);
    }
  });

  it("anon sees bylines only for authors of public articles", async () => {
    const r = await asRole(db, "anon", null, (tx) => tx.query<{ id: string }>("select id from public.profiles"));
    const ids = r.rows.map((x) => x.id);
    expect(ids).toContain(editor); // published above
    expect(ids).not.toContain(analyst);
  });
});

describe("analytics permission", () => {
  it("analyst can read analytics; writer cannot", async () => {
    const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const to = new Date().toISOString();
    const ok = await asRole(db, "authenticated", analyst, (tx) => tx.query("select public.analytics_summary($1, $2) as s", [from, to]));
    expect(ok.rows).toHaveLength(1);
    await expect(
      asRole(db, "authenticated", writer, (tx) => tx.query("select public.analytics_summary($1, $2)", [from, to])),
    ).rejects.toThrow(/not_authorized/);
  });
});
