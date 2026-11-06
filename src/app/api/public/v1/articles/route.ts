import { z } from "zod";
import { listPublicArticles } from "@/lib/cms/articles";
import { getCategoryBySlug, getTagBySlug, locationWithDescendants } from "@/lib/cms/site";
import { pageQuery, publicRead, queryObject } from "@/lib/api/public";

const query = pageQuery.extend({
  category: z.string().regex(/^[a-z0-9-]{1,120}$/).optional(),
  tag: z.string().regex(/^[a-z0-9-]{1,120}$/).optional(),
  region: z.string().regex(/^[a-z0-9-]{1,120}$/).optional(),
  featured: z.enum(["true"]).optional(),
  breaking: z.enum(["true"]).optional(),
});

export function GET(request: Request) {
  return publicRead("api_articles_failed", async () => {
    const q = query.parse(queryObject(request));
    const [category, tag, region] = await Promise.all([
      q.category ? getCategoryBySlug(q.category) : null,
      q.tag ? getTagBySlug(q.tag) : null,
      q.region ? locationWithDescendants(q.region) : null,
    ]);
    if ((q.category && !category) || (q.tag && !tag) || (q.region && !region)) return null;
    return listPublicArticles({
      page: q.page,
      pageSize: q.pageSize,
      categoryId: category?.id ?? null,
      tagId: tag?.id ?? null,
      locationIds: region?.ids,
      featured: q.featured === "true" || undefined,
      breaking: q.breaking === "true" || undefined,
    });
  });
}
