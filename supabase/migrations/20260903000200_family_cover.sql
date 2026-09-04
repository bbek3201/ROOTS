set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0014 · The family's cover photograph
-- ----------------------------------------------------------------------------
-- A family archive opens on a picture of the family. Until now the only images
-- ROOTS held belonged to a person, a couple or a memory — there was nowhere to
-- put the photograph that is about ALL of them: the one from the reunion, the
-- one on the wall at home, the one everybody agrees is "us".
--
-- That is what this column is. It is not a memory (it has no date and no
-- story), it is not a portrait (it belongs to nobody in particular), and it is
-- deliberately a pointer into `media` rather than a URL, so the cover obeys the
-- same storage policies, the same signed URLs and the same deletion rules as
-- every other photograph in the archive.
-- ============================================================================

alter table families
  add column if not exists cover_media_id uuid references media(id) on delete set null;

comment on column families.cover_media_id is
  'The photograph the whole family is shown under. Nulled, not orphaned, if the media row is deleted.';

-- ---------------------------------------------------------------------------
-- set_family_cover — choosing the cover is curation, not administration
-- ---------------------------------------------------------------------------
-- The families table itself may only be updated by admins (see the RLS
-- policies), which is right for a name, a locale or a deletion. Choosing which
-- photograph the family opens on is a smaller, more frequent act, and the
-- people who curate the archive are editors. So this is a definer function
-- with its own, narrower rule rather than a loosening of the table policy —
-- an editor can change the cover and nothing else on the row.
--
-- Passing null clears it, which is how "remove this photograph" is expressed.
create or replace function public.set_family_cover(p_family_id uuid, p_media_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ok boolean;
begin
  if not roots.can_edit(p_family_id) then
    raise exception 'only editors can change the family cover' using errcode = '42501';
  end if;

  if p_media_id is not null then
    -- The photograph must belong to THIS family and be an original photo.
    -- Without this check a valid media id from another archive — or a derived
    -- thumbnail — could be pinned to the front of the tree.
    select true into v_ok
    from public.media m
    where m.id = p_media_id
      and m.family_id = p_family_id
      and m.kind = 'photo'
      and m.variant = 'original'
      and m.deleted_at is null;

    if not found then
      raise exception 'that photograph is not available for this family' using errcode = '22023';
    end if;
  end if;

  update public.families
  set cover_media_id = p_media_id
  where id = p_family_id and deleted_at is null;

  perform roots.log_audit(p_family_id, 'family.cover_set', 'family', p_family_id,
                          jsonb_build_object('media_id', p_media_id));
end;
$$;

revoke all on function public.set_family_cover(uuid, uuid) from public, anon;
grant execute on function public.set_family_cover(uuid, uuid) to authenticated;
