import { getHomepage } from "@/lib/cms/homepage";
import { publicRead } from "@/lib/api/public";

/** Published homepage configuration (typed, validated blocks). Drafts are never exposed here. */
export function GET() {
  return publicRead("api_homepage_failed", async () => {
    const home = await getHomepage("published");
    return home ? { configurationId: home.configurationId, blocks: home.blocks } : null;
  });
}
