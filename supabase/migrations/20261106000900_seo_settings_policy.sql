-- The SEO screen (seo.manage) saves the 'seo' settings key, but settings_write only accepted
-- settings.manage, so SEO-only staff got an RLS error. Allow seo.manage for that one key.
drop policy settings_write on public.site_settings;
create policy settings_write on public.site_settings for all to authenticated
  using (public.has_permission('settings.manage') or (key = 'seo' and public.has_permission('seo.manage')))
  with check (public.has_permission('settings.manage') or (key = 'seo' and public.has_permission('seo.manage')));
