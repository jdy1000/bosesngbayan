import { listCategories } from "@/lib/cms/site";
import { publicRead } from "@/lib/api/public";

export function GET() {
  return publicRead("api_categories_failed", () => listCategories());
}
