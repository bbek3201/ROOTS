set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0015 · You may always edit yourself
-- ----------------------------------------------------------------------------
-- Editing a person requires the `editor` role, which is right: the shape of a
-- family — who married whom, whose child is whose — is not something a new
-- member should be able to rewrite on their first afternoon.
--
-- But it produces one absurd result. A cousin who joins with the family code
-- arrives as a contributor, links their account to their own person in the
-- tree, and then cannot add their own photograph or write a line about their
-- own life. The archive asks them to contribute and refuses their first
-- contribution.
--
-- This function is the exception, and it is deliberately the narrowest one that
-- fixes that: the caller may edit the person row THEY are linked to, and only
-- three fields of it — their portrait, their story, their nickname. Names,
-- dates, parents and marriages stay with the editors, because those are claims
-- about the family rather than about oneself.
-- ============================================================================

create or replace function public.update_my_person(
  p_person_id uuid,
  -- null leaves a field alone; an empty string clears it.
  p_biography text default null,
  p_nickname text default null,
  p_photo_media_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- The whole authorisation rule: this must be the person the caller IS.
  select m.family_id into v_family_id
  from public.family_members m
  where m.user_id = auth.uid()
    and m.person_id = p_person_id
    and m.status = 'active'
  limit 1;

  if v_family_id is null then
    raise exception 'you can only edit your own person' using errcode = '42501';
  end if;

  if p_photo_media_id is not null then
    -- Same check the family cover makes: the photograph must belong to this
    -- family and be an original photo, not a thumbnail or another archive's id.
    perform 1
    from public.media md
    where md.id = p_photo_media_id
      and md.family_id = v_family_id
      and md.kind = 'photo'
      and md.variant = 'original'
      and md.deleted_at is null;

    if not found then
      raise exception 'that photograph is not available for this family' using errcode = '22023';
    end if;
  end if;

  update public.people
  set biography = case when p_biography is null then biography
                       else nullif(btrim(p_biography), '') end,
      nickname  = case when p_nickname is null then nickname
                       else nullif(btrim(p_nickname), '') end,
      profile_photo_media_id = coalesce(p_photo_media_id, profile_photo_media_id)
  where id = p_person_id
    and family_id = v_family_id
    and deleted_at is null;

  perform roots.log_audit(v_family_id, 'person.self_updated', 'person', p_person_id, '{}'::jsonb);
end;
$$;

revoke all on function public.update_my_person(uuid, text, text, uuid) from public, anon;
grant execute on function public.update_my_person(uuid, text, text, uuid) to authenticated;
