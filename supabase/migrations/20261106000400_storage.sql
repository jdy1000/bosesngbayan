-- Media bucket. Public read (published imagery must be CDN-servable); objects live under
-- "<uploader uuid>/<random>.<ext>" so paths are unguessable. Writes are permission- and owner-aware.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy media_objects_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_staff());

create policy media_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media'
              and public.has_permission('media.upload')
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy media_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'media'
         and (public.has_permission('media.manage_any')
              or (public.has_permission('media.upload') and (storage.foldername(name))[1] = auth.uid()::text)))
  with check (bucket_id = 'media'
              and (public.has_permission('media.manage_any')
                   or (public.has_permission('media.upload') and (storage.foldername(name))[1] = auth.uid()::text)));

create policy media_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media'
         and (public.has_permission('media.manage_any')
              or (public.has_permission('media.upload') and (storage.foldername(name))[1] = auth.uid()::text)));
