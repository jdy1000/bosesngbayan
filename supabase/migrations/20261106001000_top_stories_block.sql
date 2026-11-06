-- News-first homepage: add the `top_stories` block (lead story + right rail + story row).
-- Rollback: delete top_stories sections, then restore the previous list without 'top_stories'.
alter table public.homepage_sections drop constraint homepage_sections_block_type_check;
alter table public.homepage_sections add constraint homepage_sections_block_type_check check (block_type in (
  'hero', 'top_stories', 'trending_topics', 'breaking_news', 'featured_story', 'latest_articles', 'article_grid',
  'category_showcase', 'editors_picks', 'most_read', 'poll_showcase', 'community', 'regional_news',
  'newsletter', 'custom_cta', 'photo_of_day', 'quote_of_day', 'news_quiz'));
