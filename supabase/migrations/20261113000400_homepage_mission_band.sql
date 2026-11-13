-- Mission band on the homepage (client decision 2026-11-13, ADR-023): a custom_cta section right after the top
-- stories with the tagline, two sentences of the client's statement (verbatim), its four calls to action, and links
-- to the tip line and the About page. Added to the draft and the published configuration so the next publish keeps it.
-- Data only; idempotent (skips a configuration that already has the band). Fresh databases get it from seed.sql.
-- Rollback:
--   delete from public.homepage_sections where block_type = 'custom_cta' and settings->'cta'->>'href' = '/mag-ulat';
--   (positions keep a one-step gap, which the renderer ignores: it only sorts by position)

do $$
declare
  v_cfg uuid;
  v_pos integer;
begin
  for v_cfg in
    select c.id from public.homepage_configurations c
    where c.status in ('draft', 'published')
      and not exists (
        select 1 from public.homepage_sections s
        where s.configuration_id = c.id and s.block_type = 'custom_cta' and s.settings->'cta'->>'href' = '/mag-ulat')
  loop
    -- Right after top_stories; at the top when a configuration has no top_stories section.
    select coalesce(max(position) filter (where block_type = 'top_stories'), 0) + 1 into v_pos
    from public.homepage_sections where configuration_id = v_cfg;

    update public.homepage_sections set position = position + 1 where configuration_id = v_cfg and position >= v_pos;

    insert into public.homepage_sections (configuration_id, block_type, position, title, description, settings)
    values (v_cfg, 'custom_cta', v_pos,
      'The People''s Voice. The Public''s Watchdog.',
      'More than a public opinion research platform, Boses ng Bayan serves as a watchdog of public service. Our commitment is to the Filipino people—not to political parties, powerful personalities, or vested interests.',
      jsonb_build_object(
        'variant', 'feature_tiles',
        'cta', jsonb_build_object('label', 'Mag-ulat ng Katiwalian', 'label_en', 'Report corruption', 'href', '/mag-ulat'),
        'secondary_cta', jsonb_build_object('label', 'Tungkol sa Amin', 'label_en', 'About us', 'href', '/tungkol'),
        'image_id', null,
        'items', jsonb_build_array(
          jsonb_build_object('icon', 'megaphone', 'label', 'Speak Up.'),
          jsonb_build_object('icon', 'newspaper', 'label', 'Seek the Truth.'),
          jsonb_build_object('icon', 'shield', 'label', 'Expose Corruption.'),
          jsonb_build_object('icon', 'vote', 'label', 'Demand Accountability.'))));
  end loop;
end;
$$;
