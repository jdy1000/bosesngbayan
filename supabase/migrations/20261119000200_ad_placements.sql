-- Ad placements modelled on a large news site's layout (client request 2026-11-19): a banner under the header (`top`),
-- a unit inside the story (`article_inline`) and a sticky side rail (`sidebar`), next to the two that existed
-- (`home` = homepage between sections, `article` = under the story). Same rules as before: one live ad per placement.
-- Rollback: delete from public.ad_slots where placement not in ('home', 'article');
--           alter table public.ad_slots drop constraint ad_slots_placement_check;
--           alter table public.ad_slots add constraint ad_slots_placement_check check (placement in ('home', 'article'));
alter table public.ad_slots drop constraint ad_slots_placement_check;
alter table public.ad_slots add constraint ad_slots_placement_check
  check (placement in ('top', 'home', 'article_inline', 'sidebar', 'article'));
