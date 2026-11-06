import { getCategoryBySlug } from "@/lib/cms/site";
import { publicRead } from "@/lib/api/public";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return publicRead("api_category_failed", () => getCategoryBySlug(slug));
}
