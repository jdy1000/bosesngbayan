import { z } from "zod";
import { NextResponse } from "next/server";
import { searchPublicArticles } from "@/lib/cms/articles";
import { pageQuery, publicRead, queryObject } from "@/lib/api/public";
import { networkHash } from "@/lib/security/hash";
import { checkRateLimit } from "@/lib/security/rate-limit";

const query = pageQuery.extend({ q: z.string().trim().min(2, "Maglagay ng hindi bababa sa 2 titik.").max(120) });

export async function GET(request: Request) {
  if (!(await checkRateLimit("search", networkHash(request.headers)))) {
    return NextResponse.json({ ok: false, error: "Masyadong maraming paghahanap." }, { status: 429 });
  }
  return publicRead("api_search_failed", () => {
    const q = query.parse(queryObject(request));
    return searchPublicArticles(q.q, q.page, q.pageSize);
  });
}
