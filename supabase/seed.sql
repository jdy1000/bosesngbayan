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

insert into public.navigation_items (menu_id, label, href, position)
select m.id, v.label, v.href, v.position
from public.navigation_menus m
join (values
  ('header', 'Bahay', '/', 1),
  ('header', 'Mga Balita', '/balita', 2),
  ('header', 'Mga Botohan', '/botohan', 3),
  ('header', 'Usap Bayan', '/usap-bayan', 4),
  ('header', 'Mga Paksa', '/paksa', 5),
  ('header', 'Tungkol', '/tungkol', 6),
  ('footer_main', 'Tungkol sa Amin', '/tungkol', 1),
  ('footer_main', 'Makipag-ugnayan', '/makipag-ugnayan', 2),
  ('footer_main', 'Patakarang Editoryal', '/patakarang-editoryal', 3),
  ('footer_main', 'Mag-advertise', '/mag-advertise', 4),
  ('footer_legal', 'Tungkol', '/tungkol', 1),
  ('footer_legal', 'Privacy Policy', '/privacy-policy', 2),
  ('footer_legal', 'Terms of Service', '/terms-of-service', 3)
) as v(menu_key, label, href, position) on v.menu_key = m.key
where not exists (select 1 from public.navigation_items i where i.menu_id = m.id);

-- Site settings (no secrets ever live here)
insert into public.site_settings (key, value) values
  ('general', jsonb_build_object(
    'site_name', 'Boses ng Bayan',
    'tagline', 'May boses ka. May saysay ang opinyon mo.',
    'description', 'Balita, botohan, at usapang bayan para sa bawat Pilipino.',
    'logo_media_id', null,
    'favicon_media_id', null,
    'brand', jsonb_build_object('primary', '#1d4ed8', 'navy', '#0b1f5c', 'accent', '#d62828'),
    'timezone', 'Asia/Manila',
    'language', 'fil',
    'default_author_id', null,
    'copyright_text', '© {year} Boses ng Bayan. Lahat ng karapatan ay nakalaan.',
    'header_cta', jsonb_build_object('label', 'Sumali sa Botohan', 'href', '/botohan'))),
  ('social', jsonb_build_object('facebook', '', 'youtube', '', 'tiktok', '', 'x', '', 'instagram', '', 'hashtag', '#BosesNgBayan')),
  ('contact', jsonb_build_object('email', '', 'phone', '', 'address', '')),
  ('seo', jsonb_build_object(
    'title_template', '%s | Boses ng Bayan',
    'default_title', 'Boses ng Bayan — Balita, Botohan at Usapang Bayan',
    'default_description', 'Makibahagi sa mga usaping mahalaga sa araw-araw na buhay ng bawat Pilipino.',
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
    (v_cfg, 'hero', 1, null, null, jsonb_build_object(
      'eyebrow', 'Tampok ngayon',
      'headline', 'May boses ka. May saysay ang opinyon mo.',
      'highlight', 'boses',
      'description', 'Makibahagi sa mga usaping mahalaga sa araw-araw na buhay ng bawat Pilipino.',
      'primary_cta', jsonb_build_object('label', 'Bumoto ngayon', 'href', '/botohan'),
      'secondary_cta', jsonb_build_object('label', 'Tingnan ang resulta', 'href', '/botohan'),
      'image_id', null,
      'poll_id', null,
      'show_participation_count', true,
      'participation_label', 'boto na ang naitala sa aming mga botohan')),
    (v_cfg, 'trending_topics', 2, 'Trending Topics:', null, jsonb_build_object(
      'view_all', jsonb_build_object('label', 'Tingnan lahat', 'href', '/paksa'))),
    (v_cfg, 'article_grid', 3, 'Mga Balita', 'Mga pinakabagong balita at mahahalagang kwento mula sa buong bansa.', jsonb_build_object(
      'source', 'latest', 'category_id', null, 'article_ids', '[]'::jsonb, 'limit', 3,
      'view_all', jsonb_build_object('label', 'Tingnan lahat ng balita', 'href', '/balita'))),
    (v_cfg, 'custom_cta', 4, 'Bakit sumali sa Boses ng Bayan?', 'Dahil ang ating tinig ay may kapangyarihan na magdulot ng pagbabago.', jsonb_build_object(
      'variant', 'feature_tiles',
      'cta', jsonb_build_object('label', 'Alamin pa', 'href', '/tungkol'),
      'image_id', null,
      'items', jsonb_build_array(
        jsonb_build_object('icon', 'chart', 'label', 'Maging bahagi ng makabuluhang botohan'),
        jsonb_build_object('icon', 'messages', 'label', 'Makilahok sa usapang bayan'),
        jsonb_build_object('icon', 'users', 'label', 'Kumonekta sa komunidad'),
        jsonb_build_object('icon', 'megaphone', 'label', 'Ibahagi ang iyong pananaw')))),
    (v_cfg, 'custom_cta', 5, E'Tayo ang Bayan.\nTayo ang Boses.', 'Sama-sama nating itaguyod ang isang mas makatarungan, mas progresibong Pilipinas.', jsonb_build_object(
      'variant', 'banner',
      'cta', jsonb_build_object('label', 'Sumali sa Komunidad', 'href', '/usap-bayan'),
      'image_id', null,
      'items', '[]'::jsonb));
  end loop;
end;
$$;
