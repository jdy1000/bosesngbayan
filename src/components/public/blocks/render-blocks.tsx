import type { HomepageBlock } from "@/lib/homepage/blocks";
import type { Messages } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";
import { HeroBlock } from "@/components/public/blocks/hero-block";
import {
  ArticleListBlock,
  BreakingNewsBlock,
  CategoryShowcaseBlock,
  FeaturedStoryBlock,
  MostReadBlock,
  RegionalNewsBlock,
  TopStoriesBlock,
  TrendingTopicsBlock,
} from "@/components/public/blocks/article-blocks";
import { CommunityBlock, CustomCtaBlock, NewsletterBlock, PollShowcaseBlock } from "@/components/public/blocks/engagement-blocks";
import { NewsQuizBlock, PhotoOfDayBlock, QuoteOfDayBlock } from "@/components/public/blocks/module-blocks";
import { SurveysBlock } from "@/components/public/blocks/survey-blocks";
import { getHomepageSurveys } from "@/lib/cms/surveys";

function Block({ block, t, between }: { block: HomepageBlock; t: Messages; between?: React.ReactNode }) {
  const { title, description } = block;
  switch (block.type) {
    case "hero":
      return <HeroBlock settings={block.settings} />;
    case "top_stories":
      return <TopStoriesBlock settings={block.settings} between={between} />;
    case "surveys":
      return <SurveysBlock title={title} standalone />;
    case "trending_topics":
      return <TrendingTopicsBlock title={title} settings={block.settings} />;
    case "breaking_news":
      return <BreakingNewsBlock settings={block.settings} />;
    case "featured_story":
      return <FeaturedStoryBlock title={title} settings={block.settings} />;
    case "latest_articles":
      return <ArticleListBlock title={title} description={description} settings={block.settings} layout="list" />;
    case "article_grid":
      return <ArticleListBlock title={title} description={description} settings={block.settings} />;
    case "editors_picks": {
      const settings = block.settings.source === "latest" ? { ...block.settings, source: "editors_picks" as const } : block.settings;
      return <ArticleListBlock title={title ?? t.blocks.editorsPicks} description={description} settings={settings} layout="side" />;
    }
    case "category_showcase":
      return <CategoryShowcaseBlock title={title} description={description} settings={block.settings} />;
    case "most_read":
      return <MostReadBlock title={title} settings={block.settings} />;
    case "poll_showcase":
      return <PollShowcaseBlock title={title} description={description} settings={block.settings} />;
    case "community":
      return <CommunityBlock title={title} description={description} settings={block.settings} />;
    case "regional_news":
      return <RegionalNewsBlock title={title} description={description} settings={block.settings} />;
    case "newsletter":
      return <NewsletterBlock title={title} description={description} settings={block.settings} />;
    case "custom_cta":
      return <CustomCtaBlock title={title} description={description} settings={block.settings} />;
    case "photo_of_day":
      return <PhotoOfDayBlock title={title} settings={block.settings} />;
    case "quote_of_day":
      return <QuoteOfDayBlock title={title} settings={block.settings} />;
    case "news_quiz":
      return <NewsQuizBlock title={title} settings={block.settings} />;
  }
}

/**
 * The block list as rendered: a Surveys block directly after the top stories is not a block of its own but the band
 * between the lead story and the story grid (client request 2026-11-18), so it is handed to the top stories.
 */
export function attachedSurveys(blocks: HomepageBlock[], index: number): boolean {
  return blocks[index]?.type === "surveys" && blocks[index - 1]?.type === "top_stories";
}

export async function RenderBlocks({ blocks }: { blocks: HomepageBlock[] }) {
  const { t } = await getI18n();
  // Fetched once, here, so the top stories know whether there is a band to make room for (no published survey = no gap).
  const surveys = blocks.some((_, i) => attachedSurveys(blocks, i)) ? await getHomepageSurveys() : [];
  return blocks.map((block, i) => {
    if (attachedSurveys(blocks, i)) return null;
    const next = blocks[i + 1];
    const between =
      block.type === "top_stories" && next && attachedSurveys(blocks, i + 1) && surveys.length > 0 ? <SurveysBlock title={next.title} surveys={surveys} /> : undefined;
    return <Block key={block.id} block={block} t={t} between={between} />;
  });
}
