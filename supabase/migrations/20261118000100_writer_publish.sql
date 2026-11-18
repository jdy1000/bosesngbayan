-- Authors and editors publish without a review (client decision 2026-11-18).
--  * Writers ("authors") get articles.publish: they can publish or schedule their own drafts and unpublish their own articles.
--  * Editors, administrators and owners already had it; nothing changes for them.
--  * transition_article: a publisher may only act on their OWN article unless they also hold articles.edit_any, so a writer
--    cannot unpublish someone else's story by id (the function is SECURITY DEFINER and reads past RLS).
--  * articles_guard: homepage placement flags (featured / breaking / editor's pick) now need publish AND edit_any, so
--    giving writers publish does not let them raise the red breaking banner or pin stories. Editors and above are unchanged.
--  * transition_article: republishing a story that was unpublished (and possibly edited) marks it as updated ("Na-update"),
--    so an author cannot quietly rewrite a live story by unpublishing, editing and publishing it again.
-- Review stays available: Submit for review, the review queue, approve and reject are untouched.
-- Rollback: delete from public.role_permissions where role = 'writer' and permission = 'articles.publish'; then re-run the two
--           functions from 20261106000200_content.sql (transition_article, articles_guard).

insert into public.role_permissions (role, permission) values ('writer', 'articles.publish')
on conflict do nothing;

create or replace function public.transition_article(
  p_article_id uuid,
  p_to public.article_status,
  p_note text default null,
  p_publish_at timestamptz default null
) returns public.articles language plpgsql security definer set search_path = public as $$
declare
  a public.articles;
  v_from public.article_status;
  v_uid uuid := auth.uid();
  v_is_author boolean;
  v_ok boolean := false;
  v_service boolean := public.is_service_context();
  v_can_publish boolean;
begin
  if not v_service and not public.is_staff() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into a from public.articles where id = p_article_id for update;
  if not found then
    raise exception 'article_not_found' using errcode = 'P0002';
  end if;
  v_from := a.status;
  v_is_author := a.author_id = v_uid;
  -- A publisher acts on their own articles; acting on someone else's needs edit_any (editor and above).
  v_can_publish := public.has_permission('articles.publish') and (v_is_author or public.has_permission('articles.edit_any'));

  if v_from = p_to then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;

  v_ok := case
    when v_from in ('draft', 'rejected') and p_to = 'pending_review'
      then public.has_permission('articles.submit') and (v_is_author or public.has_permission('articles.edit_any'))
    when v_from = 'pending_review' and p_to = 'draft'
      then (v_is_author and public.has_permission('articles.submit')) or public.has_permission('articles.review')
    when v_from = 'rejected' and p_to = 'draft'
      then v_is_author or public.has_permission('articles.edit_any')
    when v_from = 'pending_review' and p_to in ('approved', 'rejected')
      then public.has_permission('articles.review')
    when v_from in ('approved', 'draft') and p_to in ('published', 'scheduled')
      then v_can_publish
    when v_from = 'approved' and p_to = 'draft'
      then public.has_permission('articles.review') or v_can_publish
    when v_from = 'scheduled' and p_to in ('published', 'draft')
      then v_service or v_can_publish
    when v_from = 'published' and p_to = 'draft'
      then v_can_publish
    when v_from <> 'archived' and p_to = 'archived'
      then public.has_permission('articles.archive')
    when v_from = 'archived' and p_to = 'draft'
      then public.has_permission('articles.archive')
    else false
  end;

  if not v_ok then
    raise exception 'transition_not_allowed' using errcode = '42501';
  end if;

  if p_to = 'rejected' and coalesce(btrim(p_note), '') = '' then
    raise exception 'rejection_reason_required' using errcode = '22023';
  end if;
  if p_to in ('published', 'scheduled', 'pending_review') then
    if a.category_id is null then
      raise exception 'category_required' using errcode = '22023';
    end if;
    if coalesce(btrim(a.body_text), '') = '' then
      raise exception 'body_required' using errcode = '22023';
    end if;
  end if;
  if p_to = 'scheduled' and (p_publish_at is null or p_publish_at <= now()) then
    raise exception 'schedule_must_be_future' using errcode = '22023';
  end if;

  update public.articles set
    status = p_to,
    submitted_at = case when p_to = 'pending_review' then now() else submitted_at end,
    rejection_reason = case when p_to = 'rejected' then left(btrim(p_note), 2000)
                            when p_to = 'pending_review' then null else rejection_reason end,
    review_note = case when p_to = 'approved' then left(nullif(btrim(p_note), ''), 2000) else review_note end,
    reviewed_at = case when p_to in ('approved', 'rejected') then now() else reviewed_at end,
    reviewed_by = case when p_to in ('approved', 'rejected') then v_uid else reviewed_by end,
    approved_at = case when p_to = 'approved' then now()
                       when p_to in ('published', 'scheduled') and v_from = 'draft' then now() else approved_at end,
    approved_by = case when p_to = 'approved' then v_uid
                       when p_to in ('published', 'scheduled') and v_from = 'draft' then v_uid else approved_by end,
    published_at = case
      when p_to = 'scheduled' then p_publish_at
      when p_to = 'published' and v_from = 'scheduled' and a.published_at <= now() then a.published_at
      when p_to = 'published' then coalesce(a.first_published_at, now())
      when p_to = 'draft' and v_from = 'scheduled' then a.first_published_at
      else published_at end,
    first_published_at = case
      when p_to = 'published' and v_from = 'scheduled' and a.published_at <= now() then coalesce(a.first_published_at, a.published_at)
      when p_to = 'published' then coalesce(a.first_published_at, now())
      else first_published_at end,
    published_by = case when p_to in ('published', 'scheduled') then coalesce(v_uid, published_by) else published_by end,
    archived_at = case when p_to = 'archived' then now() when v_from = 'archived' then null else archived_at end,
    content_updated_at = case when p_to = 'published' and v_from in ('draft', 'approved') and a.first_published_at is not null
                              then now() else content_updated_at end
  where id = p_article_id
  returning * into a;

  insert into public.content_activity_logs (actor_id, entity_type, entity_id, action, from_status, to_status, note)
  values (v_uid, 'article', p_article_id,
          case when v_uid is null then 'scheduler' else 'transition' end,
          v_from::text, p_to::text, left(nullif(btrim(p_note), ''), 2000));

  if p_to in ('published', 'scheduled', 'pending_review') then
    perform public.snapshot_article(p_article_id, 'Status: ' || p_to::text);
  end if;
  return a;
end;
$$;

create or replace function public.articles_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then
      new.status := 'draft';
      new.published_at := null; new.first_published_at := null; new.content_updated_at := null;
      new.submitted_at := null; new.reviewed_at := null; new.reviewed_by := null;
      new.approved_at := null; new.approved_by := null; new.published_by := null;
      new.rejection_reason := null; new.review_note := null; new.archived_at := null;
      new.created_by := auth.uid();
      if not (public.has_permission('articles.publish') and public.has_permission('articles.edit_any')) then
        new.is_featured := false; new.is_breaking := false; new.is_editors_pick := false;
      end if;
    end if;
    return new;
  end if;

  new.updated_at := now();
  if current_user in ('authenticated', 'anon') then
    if new.status is distinct from old.status
       or new.published_at is distinct from old.published_at
       or new.first_published_at is distinct from old.first_published_at
       or new.submitted_at is distinct from old.submitted_at
       or new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.published_by is distinct from old.published_by
       or new.rejection_reason is distinct from old.rejection_reason
       or new.review_note is distinct from old.review_note
       or new.archived_at is distinct from old.archived_at
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'workflow_fields_protected' using errcode = '42501';
    end if;
    if (new.is_featured is distinct from old.is_featured
        or new.is_breaking is distinct from old.is_breaking
        or new.is_editors_pick is distinct from old.is_editors_pick)
       and not (public.has_permission('articles.publish') and public.has_permission('articles.edit_any')) then
      raise exception 'placement_requires_publish_permission' using errcode = '42501';
    end if;
    if new.author_id is distinct from old.author_id and not public.has_permission('articles.edit_any') then
      raise exception 'author_change_not_allowed' using errcode = '42501';
    end if;
    -- Substantive edits to live content are surfaced publicly as "Na-update".
    if public.article_is_public(old.status, old.published_at)
       and (new.title is distinct from old.title or new.body is distinct from old.body
            or new.subtitle is distinct from old.subtitle or new.correction_note is distinct from old.correction_note) then
      new.content_updated_at := now();
    end if;
  end if;
  return new;
end;
$$;
