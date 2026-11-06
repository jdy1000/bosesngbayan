import "server-only";
import { z } from "zod";
import type { StaffContext } from "@/lib/auth/session";
import type { DateRange } from "@/lib/studio/range";

/** Contract for public.analytics_summary(from, to). Validated because it is untyped JSON. */
const n = z.coerce.number().int().nonnegative().catch(0);
const day = z.string();

export const analyticsSummarySchema = z.object({
  page_views: n,
  daily_unique_visitors_sum: n,
  poll_ballots: n,
  new_subscribers: n,
  articles_published: n,
  views_by_day: z.array(z.object({ day, views: n, visitors: n })).catch([]),
  ballots_by_day: z.array(z.object({ day, ballots: n })).catch([]),
  subscribers_by_day: z.array(z.object({ day, subscribers: n })).catch([]),
  published_by_day: z.array(z.object({ day, articles: n })).catch([]),
  top_articles: z.array(z.object({ article_id: z.string(), title: z.string(), slug: z.string(), views: n })).catch([]),
  top_categories: z.array(z.object({ category_id: z.string(), name: z.string(), views: n })).catch([]),
  top_referrers: z.array(z.object({ host: z.string(), views: n })).catch([]),
  top_polls: z.array(z.object({ poll_id: z.string(), question: z.string(), ballots: n })).catch([]),
});
export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;

/** Runs as the signed-in user; the function itself re-checks analytics.view. */
export async function loadAnalyticsSummary(ctx: StaffContext, range: DateRange): Promise<AnalyticsSummary> {
  const { data, error } = await ctx.supabase.rpc("analytics_summary", { p_from: range.fromIso, p_to: range.toIso });
  if (error) throw error;
  return analyticsSummarySchema.parse(data ?? {});
}
