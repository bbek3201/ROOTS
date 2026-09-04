set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0015 · What has happened since you last looked
-- ----------------------------------------------------------------------------
-- An archive that nobody returns to is a hard drive. The thing that brings a
-- family back is knowing that someone else added something: a cousin scanning
-- a box of prints, a daughter recording her grandmother.
--
-- ROOTS deliberately does not build a notifications table. A notification is a
-- copy of an event, and copies go stale, need delivery, need read receipts, and
-- need cleaning up when the thing they point at is deleted. The archive already
-- knows when every memory, photograph and person was added — so "new" is not a
-- stored fact but a comparison: content newer than the last time this member
-- opened the family.
--
-- One column, therefore, and no second source of truth.
-- ============================================================================

alter table family_members
  add column if not exists last_seen_at timestamptz;

comment on column family_members.last_seen_at is
  'When this member last opened the family home. Null means never — a first visit shows nothing as new rather than everything.';

-- ---------------------------------------------------------------------------
-- touch_last_seen — a member marking their own visit
-- ---------------------------------------------------------------------------
-- The family_members update policy already lets a member edit their own row, so
-- this could be a plain update. It is a definer function instead for one
-- reason: that policy also lets a member write every other column on their row,
-- and a heartbeat that runs on every page load should not be able to touch
-- person_id or status if it is ever wrong. This can only move the clock.
--
-- The clock only moves forward. Two tabs open at once, or a slow request
-- landing after a fast one, must not rewind the mark and re-announce news the
-- member has already seen.
create or replace function public.touch_last_seen(p_family_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_previous timestamptz;
begin
  if not roots.is_member(p_family_id) then
    raise exception 'not a member of that family' using errcode = '42501';
  end if;

  select last_seen_at into v_previous
  from public.family_members
  where family_id = p_family_id and user_id = auth.uid();

  update public.family_members
  set last_seen_at = greatest(now(), coalesce(last_seen_at, now()))
  where family_id = p_family_id and user_id = auth.uid();

  -- Returns the PREVIOUS mark, which is what "new since" actually means: the
  -- caller has just arrived, so news is everything after their last visit, not
  -- after this one.
  return v_previous;
end;
$$;

revoke all on function public.touch_last_seen(uuid) from public, anon;
grant execute on function public.touch_last_seen(uuid) to authenticated;
