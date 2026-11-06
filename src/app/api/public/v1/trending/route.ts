import { listTrendingTopics } from "@/lib/cms/site";
import { publicRead } from "@/lib/api/public";

/** Editorially configured topics (Studio → Kategorya at Tag). No activity metrics are implied. */
export function GET() {
  return publicRead("api_trending_failed", () => listTrendingTopics());
}
