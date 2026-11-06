import type { HomepageBlock } from "@/lib/homepage/blocks";
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

function Block({ block }: { block: HomepageBlock }) {
  const { title, description } = block;
  switch (block.type) {
    case "hero":
      return <HeroBlock settings={block.settings} />;
    case "top_stories":
      return <TopStoriesBlock settings={block.settings} />;
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
      return <ArticleListBlock title={title ?? "Pili ng Editor"} description={description} settings={settings} layout="side" />;
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

export function RenderBlocks({ blocks }: { blocks: HomepageBlock[] }) {
  return blocks.map((block) => <Block key={block.id} block={block} />);
}
