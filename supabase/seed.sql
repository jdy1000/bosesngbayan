-- Boses ng Bayan — BASELINE seed. Structural, production-safe defaults only:
-- categories, locations, navigation, site settings, trending topics, starter pages (drafts),
-- and a starter homepage configuration. No users, no news, no votes, no metrics.
-- Every value here is editable in Boses ng Bayan Studio. Demo content lives in scripts/seed-demo.ts.

-- Categories (suggested starter set; editable/removable in Studio)
insert into public.categories (slug, name, description, is_featured, sort_order) values
  ('pilipinas', 'Pilipinas', 'Mga balita mula sa iba''t ibang panig ng bansa.', true, 10),
  ('pulitika', 'Pulitika', 'Pamahalaan, halalan, at mga patakarang pampubliko.', true, 20),
  ('business', 'Business', 'Negosyo, merkado, at industriya.', false, 30),
  ('ekonomiya', 'Ekonomiya', 'Presyo, sahod, at ang kalagayan ng ekonomiya.', true, 40),
  ('edukasyon', 'Edukasyon', 'Paaralan, guro, mag-aaral, at patakarang pang-edukasyon.', true, 50),
  ('kalusugan', 'Kalusugan', 'Kalusugang pampubliko at serbisyong medikal.', true, 60),
  ('teknolohiya', 'Teknolohiya', 'Teknolohiya, internet, at inobasyon.', false, 70),
  ('transportasyon', 'Transportasyon', 'Pampublikong sasakyan, kalsada, at biyahe.', true, 80),
  ('trabaho', 'Trabaho', 'Hanapbuhay, sahod, at karapatan ng manggagawa.', true, 90),
  ('entertainment', 'Entertainment', 'Showbiz, pelikula, at musika.', false, 100),
  ('sports', 'Sports', 'Palakasan at mga atletang Pilipino.', false, 110),
  ('lifestyle', 'Lifestyle', 'Pamumuhay, pagkain, at kultura.', false, 120),
  ('opinion', 'Opinion', 'Mga kolum at pananaw.', false, 130),
  ('komunidad', 'Komunidad', 'Mga kwento mula sa mga barangay at komunidad.', true, 140),
  ('exposed', 'Exposed', 'Mga imbestigatibong ulat.', false, 150),
  ('housing', 'Housing', 'Pabahay at abot-kayang tirahan.', false, 160),
  ('lipunan', 'Lipunan', 'Mga usaping panlipunan.', false, 170)
on conflict (slug) do nothing;

-- Locations: island groups and administrative regions (official names). Provinces/cities are added in Studio.
insert into public.locations (slug, name, kind, sort_order) values
  ('luzon', 'Luzon', 'island_group', 1),
  ('visayas', 'Visayas', 'island_group', 2),
  ('mindanao', 'Mindanao', 'island_group', 3)
on conflict (slug) do nothing;

insert into public.locations (slug, name, kind, parent_id, sort_order)
select v.slug, v.name, 'region', p.id, v.sort_order
from (values
  ('ncr', 'National Capital Region', 'luzon', 1),
  ('car', 'Cordillera Administrative Region', 'luzon', 2),
  ('ilocos', 'Ilocos Region', 'luzon', 3),
  ('cagayan-valley', 'Cagayan Valley', 'luzon', 4),
  ('central-luzon', 'Central Luzon', 'luzon', 5),
  ('calabarzon', 'CALABARZON', 'luzon', 6),
  ('mimaropa', 'MIMAROPA', 'luzon', 7),
  ('bicol', 'Bicol Region', 'luzon', 8),
  ('western-visayas', 'Western Visayas', 'visayas', 1),
  ('negros-island-region', 'Negros Island Region', 'visayas', 2),
  ('central-visayas', 'Central Visayas', 'visayas', 3),
  ('eastern-visayas', 'Eastern Visayas', 'visayas', 4),
  ('zamboanga-peninsula', 'Zamboanga Peninsula', 'mindanao', 1),
  ('northern-mindanao', 'Northern Mindanao', 'mindanao', 2),
  ('davao-region', 'Davao Region', 'mindanao', 3),
  ('soccsksargen', 'SOCCSKSARGEN', 'mindanao', 4),
  ('caraga', 'Caraga', 'mindanao', 5),
  ('barmm', 'Bangsamoro Autonomous Region in Muslim Mindanao', 'mindanao', 6)
) as v(slug, name, parent_slug, sort_order)
join public.locations p on p.slug = v.parent_slug
on conflict (slug) do nothing;

-- Navigation
insert into public.navigation_menus (key, name) values
  ('header', 'Pangunahing navigation'),
  ('footer_main', 'Footer — mga link'),
  ('footer_legal', 'Footer — legal')
on conflict (key) do nothing;

insert into public.navigation_items (menu_id, label, label_en, href, position)
select m.id, v.label, v.label_en, v.href, v.position
from public.navigation_menus m
join (values
  ('header', 'Balita', 'News', '/balita', 1),
  ('header', 'Pilipinas', 'Philippines', '/paksa/pilipinas', 2),
  ('header', 'Pulitika', 'Politics', '/paksa/pulitika', 3),
  ('header', 'Ekonomiya', 'Economy', '/paksa/ekonomiya', 4),
  ('header', 'Kalusugan', 'Health', '/paksa/kalusugan', 5),
  ('header', 'Teknolohiya', 'Technology', '/paksa/teknolohiya', 6),
  ('header', 'Sports', 'Sports', '/paksa/sports', 7),
  ('header', 'Opinion', 'Opinion', '/paksa/opinion', 8),
  ('header', 'Usap Bayan', 'Usap Bayan', '/usap-bayan', 9),
  ('footer_main', 'Tungkol sa Amin', 'About Us', '/tungkol', 1),
  ('footer_main', 'Mga Paksa', 'Topics', '/paksa', 2),
  ('footer_main', 'Botohan', 'Polls', '/botohan', 3),
  ('footer_main', 'Makipag-ugnayan', 'Contact', '/makipag-ugnayan', 4),
  ('footer_main', 'Patakarang Editoryal', 'Editorial Policy', '/patakarang-editoryal', 5),
  ('footer_main', 'Mag-advertise', 'Advertise', '/mag-advertise', 6),
  ('footer_legal', 'Tungkol', 'About', '/tungkol', 1),
  ('footer_legal', 'Privacy Policy', 'Privacy Policy', '/privacy-policy', 2),
  ('footer_legal', 'Terms of Service', 'Terms of Service', '/terms-of-service', 3)
) as v(menu_key, label, label_en, href, position) on v.menu_key = m.key
where not exists (select 1 from public.navigation_items i where i.menu_id = m.id);

-- Site settings (no secrets ever live here)
insert into public.site_settings (key, value) values
  ('general', jsonb_build_object(
    'site_name', 'Boses ng Bayan',
    'tagline', 'The People''s Voice. The Public''s Watchdog.',
    'description', 'Boses ng Bayan is an independent public-interest research, news, and investigative journalism platform dedicated to measuring public trust, evaluating governance performance, monitoring public sentiment, and promoting transparency and accountability in government.',
    'logo_media_id', null,
    'favicon_media_id', null,
    'brand', jsonb_build_object('primary', '#1d4ed8', 'navy', '#0b1f5c', 'accent', '#d62828'),
    'timezone', 'Asia/Manila',
    'language', 'fil',
    'default_author_id', null,
    'copyright_text', '© {year} Boses ng Bayan. Lahat ng karapatan ay nakalaan.',
    'header_cta', jsonb_build_object('label', 'Mag-subscribe', 'href', '/#newsletter'))),
  ('social', jsonb_build_object('facebook', '', 'youtube', '', 'tiktok', '', 'x', '', 'instagram', '', 'hashtag', '#BosesNgBayan')),
  ('contact', jsonb_build_object('email', '', 'phone', '', 'address', '')),
  ('seo', jsonb_build_object(
    'title_template', '%s | Boses ng Bayan',
    'default_title', 'Boses ng Bayan — The People''s Voice. The Public''s Watchdog.',
    'default_description', 'Boses ng Bayan is an independent public-interest research, news, and investigative journalism platform dedicated to measuring public trust, evaluating governance performance, monitoring public sentiment, and promoting transparency and accountability in government.',
    'default_og_image_id', null,
    'x_handle', '',
    'allow_indexing', true)),
  ('footer', jsonb_build_object(
    'newsletter_title', 'Manatiling updated!',
    'newsletter_description', 'Mag-subscribe para sa pinakabagong balita at botohan.',
    'show_category_links', true)),
  ('publication', jsonb_build_object('articles_per_page', 12, 'show_reading_time', true, 'comments_enabled', true)),
  ('community', jsonb_build_object(
    'moderation_enabled', true,
    'submissions_enabled', true,
    'guidelines', 'Maging magalang. Walang paninira, pananakot, o personal na impormasyon ng iba. Lahat ng isinumite ay sinusuri muna ng aming mga moderator bago lumabas.')),
  ('newsletter', jsonb_build_object(
    'enabled', true,
    'consent_text', 'Pumapayag akong makatanggap ng newsletter ng Boses ng Bayan sa email na ito. Maaari akong mag-unsubscribe anumang oras.'))
on conflict (key) do nothing;

-- Trending topics (editorially curated, linked to categories)
insert into public.trending_topics (label, category_id, position)
select c.name, c.id, v.position
from (values ('transportasyon', 1), ('edukasyon', 2), ('kalusugan', 3), ('trabaho', 4), ('housing', 5), ('ekonomiya', 6), ('pulitika', 7), ('komunidad', 8)) as v(slug, position)
join public.categories c on c.slug = v.slug
where not exists (select 1 from public.trending_topics);

-- Starter pages are created as DRAFTS so nothing unreviewed goes public.
insert into public.pages (slug, title, summary, status) values
  ('tungkol', 'Tungkol sa Boses ng Bayan', 'Sino kami at bakit kami narito.', 'draft'),
  ('makipag-ugnayan', 'Makipag-ugnayan', 'Paano kami makakausap.', 'draft'),
  ('patakarang-editoryal', 'Patakarang Editoryal', 'Ang aming mga pamantayan sa pamamahayag.', 'draft'),
  ('privacy-policy', 'Privacy Policy', 'Paano namin pinangangalagaan ang iyong datos.', 'draft'),
  ('terms-of-service', 'Terms of Service', 'Mga tuntunin sa paggamit ng site.', 'draft'),
  ('mag-advertise', 'Mag-advertise sa Amin', 'Mga oportunidad para sa advertising.', 'draft')
on conflict (slug) do nothing;

-- Starter homepage: same sections in the working draft and the first published version.
do $$
declare
  v_draft uuid;
  v_pub uuid;
  v_cfg uuid;
begin
  if exists (select 1 from public.homepage_configurations) then
    return;
  end if;
  insert into public.homepage_configurations (status, label) values ('draft', 'Working draft') returning id into v_draft;
  insert into public.homepage_configurations (status, label, published_at) values ('published', 'Panimulang bersyon', now()) returning id into v_pub;
  foreach v_cfg in array array[v_draft, v_pub] loop
    insert into public.homepage_sections (configuration_id, block_type, position, title, description, settings) values
    (v_cfg, 'trending_topics', 1, 'Trending', null, jsonb_build_object(
      'view_all', jsonb_build_object('label', 'Lahat ng paksa', 'href', '/paksa'))),
    (v_cfg, 'breaking_news', 2, null, null, jsonb_build_object('limit', 5)),
    (v_cfg, 'top_stories', 3, null, null, jsonb_build_object(
      'lead_source', 'featured', 'lead_article_id', null, 'rail_count', 4, 'below_count', 3)),
    (v_cfg, 'latest_articles', 4, 'Pinakabagong Balita', null, jsonb_build_object(
      'source', 'latest', 'category_id', null, 'article_ids', '[]'::jsonb, 'limit', 6, 'with_sidebar', true,
      'view_all', jsonb_build_object('label', 'Lahat ng balita', 'href', '/balita'))),
    (v_cfg, 'editors_picks', 5, 'Pili ng Editor', null, jsonb_build_object(
      'source', 'editors_picks', 'category_id', null, 'article_ids', '[]'::jsonb, 'limit', 6, 'with_sidebar', false, 'view_all', null)),
    (v_cfg, 'newsletter', 6, 'Balitang mahalaga, diretso sa inbox mo.', 'Isang maikling buod ng mga pangunahing balita, isang beses sa isang araw. Libre at puwedeng ihinto anumang oras.', jsonb_build_object('source', 'homepage')),
    (v_cfg, 'category_showcase', 7, 'Mga Seksyon', null, jsonb_build_object('category_ids', '[]'::jsonb, 'per_category', 4)),
    (v_cfg, 'regional_news', 8, 'Balitang Rehiyon', 'Mga kwento mula sa Luzon, Visayas, at Mindanao.', jsonb_build_object('location_ids', '[]'::jsonb, 'per_location', 3)),
    (v_cfg, 'poll_showcase', 9, 'Botohan ng Araw', null, jsonb_build_object('poll_id', null, 'show_active_list', false, 'limit', 3));
  end loop;
end;
$$;

-- English labels for the FIL/EN switch (ADR-015). Idempotent: fills only values that are still empty.
update public.homepage_sections s set
  title_en = coalesce(s.title_en, v.title_en),
  description_en = coalesce(s.description_en, v.description_en)
from (values
  ('Trending', 'Trending', null),
  ('Pinakabagong Balita', 'Latest News', null),
  ('Pili ng Editor', 'Editor''s Picks', null),
  ('Balitang mahalaga, diretso sa inbox mo.', 'News that matters, straight to your inbox.', 'A short summary of the top stories, once a day. Free, and you can stop anytime.'),
  ('Mga Seksyon', 'Sections', null),
  ('Balitang Rehiyon', 'Regional News', 'Stories from Luzon, Visayas and Mindanao.'),
  ('Botohan ng Araw', 'Poll of the Day', null)
) as v(title, title_en, description_en)
where s.title = v.title and (s.title_en is null or s.description_en is null);

update public.site_settings set value = jsonb_build_object(
    'tagline_en', 'The People''s Voice. The Public''s Watchdog.',
    'description_en', 'Boses ng Bayan is an independent public-interest research, news, and investigative journalism platform dedicated to measuring public trust, evaluating governance performance, monitoring public sentiment, and promoting transparency and accountability in government.',
    'copyright_text_en', '© {year} Boses ng Bayan. All rights reserved.') || value
  || jsonb_build_object('header_cta', coalesce(value->'header_cta', 'null'::jsonb) || jsonb_build_object('label_en', coalesce(nullif(value->'header_cta'->>'label_en', ''), 'Subscribe')))
where key = 'general' and value ? 'header_cta' and jsonb_typeof(value->'header_cta') = 'object';

update public.site_settings set value = jsonb_build_object(
    'newsletter_title_en', 'Stay updated!',
    'newsletter_description_en', 'Subscribe for the latest news and polls.') || value
where key = 'footer';

update public.site_settings set value = jsonb_build_object(
    'guidelines_en', 'Be respectful. No smears, threats, or other people''s personal information. Every submission is reviewed by our moderators before it appears.') || value
where key = 'community';

update public.site_settings set value = jsonb_build_object(
    'consent_text_en', 'I agree to receive the Boses ng Bayan newsletter at this email address. I can unsubscribe at any time.') || value
where key = 'newsletter';

update public.homepage_sections set settings = jsonb_set(settings, '{view_all,label_en}', to_jsonb(case settings->'view_all'->>'label' when 'Lahat ng paksa' then 'All topics' else 'All news' end))
where settings->'view_all'->>'label' in ('Lahat ng paksa', 'Lahat ng balita') and coalesce(settings->'view_all'->>'label_en', '') = '';
