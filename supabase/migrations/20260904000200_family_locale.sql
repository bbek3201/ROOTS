set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0016 · Letting a family choose its language
-- ----------------------------------------------------------------------------
-- families.default_locale has existed since the first migration and is read all
-- over the application: which kinship vocabulary describes a relationship,
-- how a date is written, which language the AI answers in, which language a
-- recording is transcribed as. Every one of those is a real branch in the code.
--
-- Nothing could ever change it. create_family hard-codes 'mn' and no screen
-- offers the setting, so the English kinship locale — written, tested, and
-- carrying the full авга/нагац distinction in reverse — was unreachable.
--
-- This is the missing half. A definer function rather than a loosening of the
-- families policy, for the same reason as set_family_cover: an admin should be
-- able to change the language without the write also being able to touch the
-- family's name or its deletion mark.
-- ============================================================================

-- The locales ROOTS actually ships a kinship vocabulary for. A code that is not
-- in this list would silently fall back to Mongolian at render time, which
-- would look like the setting had not saved.
create or replace function public.set_family_locale(p_family_id uuid, p_locale text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not roots.can_admin(p_family_id) then
    raise exception 'only admins can change the family language' using errcode = '42501';
  end if;

  if p_locale not in ('mn', 'en') then
    raise exception 'unsupported locale' using errcode = '22023';
  end if;

  update public.families
  set default_locale = p_locale
  where id = p_family_id and deleted_at is null;

  perform roots.log_audit(p_family_id, 'family.locale_set', 'family', p_family_id,
                          jsonb_build_object('locale', p_locale));
end;
$$;

revoke all on function public.set_family_locale(uuid, text) from public, anon;
grant execute on function public.set_family_locale(uuid, text) to authenticated;
