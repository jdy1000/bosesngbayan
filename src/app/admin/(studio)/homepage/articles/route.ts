import { NextResponse, type NextRequest } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { logServerError } from "@/lib/log";
import type { PickedArticle } from "../types";

/** Published-article search for the homepage builder's manual pickers. */
export async function GET(request: NextRequest) {
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ error: "Kailangan mong mag-login." }, { status: 401 });
  if (!staff.permissions.has("homepage.manage")) return NextResponse.json({ error: "Wala kang pahintulot." }, { status: 403 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  let query = staff.supabase.from("articles").select("id, title").in("status", ["published", "scheduled"]).lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(20);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, " ")}%`);
  const { data, error } = await query;
  if (error) {
    logServerError("homepage_article_search_failed", error);
    return NextResponse.json({ error: "Hindi makuha ang mga artikulo." }, { status: 500 });
  }
  const items: PickedArticle[] = (data ?? []).map((a) => ({ id: a.id, title: a.title, published: true }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
