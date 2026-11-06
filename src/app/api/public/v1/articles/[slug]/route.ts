import { getPublicArticleBySlug } from "@/lib/cms/articles";
import { publicRead } from "@/lib/api/public";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return publicRead("api_article_failed", () => getPublicArticleBySlug(slug));
}
