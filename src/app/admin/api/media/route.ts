import { NextResponse, type NextRequest } from "next/server";
import { getStaffContext } from "@/lib/auth/session";
import { mediaUrl } from "@/lib/media";
import { logServerError } from "@/lib/log";

export interface MediaPickerItem {
  id: string;
  url: string | null;
  file_name: string;
  title: string | null;
  alt_text: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
}

/** Image search for Studio pickers. Any active staff member; RLS governs what the session can read. */
export async function GET(request: NextRequest) {
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ error: "Kailangan mong mag-login." }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  let query = staff.supabase
    .from("media_assets")
    .select("id, storage_path, external_url, file_name, title, alt_text, credit, width, height")
    .eq("kind", "image")
    .order("created_at", { ascending: false })
    .limit(48);
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    query = query.or(`title.ilike.${like},file_name.ilike.${like},alt_text.ilike.${like}`);
  }
  const { data, error } = await query;
  if (error) {
    logServerError("media_picker_search_failed", error);
    return NextResponse.json({ error: "Hindi makuha ang media." }, { status: 500 });
  }
  const items: MediaPickerItem[] = (data ?? []).map((m) => ({
    id: m.id,
    url: mediaUrl(m),
    file_name: m.file_name,
    title: m.title,
    alt_text: m.alt_text,
    credit: m.credit,
    width: m.width,
    height: m.height,
  }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
