set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0010 · Private storage
-- ----------------------------------------------------------------------------
-- Layout (single private bucket, family_id always the second segment):
--   families/{family_id}/people/{person_id}/original/{uuid}.jpg
--   families/{family_id}/people/{person_id}/derived/{uuid}.jpg
--   families/{family_id}/memories/{memory_id}/original/...
--   families/{family_id}/photos/original/...      families/{family_id}/photos/derived/...
--   families/{family_id}/videos/...  audio/...  documents/...
--
-- "original" and "derived" are separate prefixes so a restoration or
-- colorisation job can never write over the scan it was made from.
--
-- The bucket is private. Files are only ever reached through short-lived signed
-- URLs minted server-side after a membership check.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-media', 'family-media', false,
  1073741824,  -- 1 GiB: old family video is large and irreplaceable
  array[
    'image/jpeg','image/png','image/webp','image/heic','image/heif','image/tiff','image/gif',
    'video/mp4','video/quicktime','video/webm','video/x-matroska',
    'audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/webm','audio/ogg','audio/aac','audio/flac',
    'application/pdf','image/bmp','text/plain'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Extract family_id from an object path, returning null for anything that does
-- not match the expected layout. A malformed path therefore fails closed.
create or replace function roots.family_from_object_path(p_path text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_parts text[];
begin
  v_parts := string_to_array(p_path, '/');
  if array_length(v_parts, 1) < 3 or v_parts[1] <> 'families' then
    return null;
  end if;
  return v_parts[2]::uuid;
exception
  when others then
    return null;
end;
$$;

-- Reads: any active member of the owning family.
create policy "family media read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'family-media'
    and roots.family_from_object_path(name) is not null
    and roots.is_member(roots.family_from_object_path(name))
  );

-- Writes: contributor and above, and only into their own family's prefix.
create policy "family media insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'family-media'
    and roots.family_from_object_path(name) is not null
    and roots.can_contribute(roots.family_from_object_path(name))
  );

-- Updates are restricted to the derived/ prefix. There is no path by which a
-- client can overwrite a file stored under original/.
create policy "family media update derived only" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'family-media'
    and roots.family_from_object_path(name) is not null
    and roots.can_edit(roots.family_from_object_path(name))
    and name like '%/derived/%'
  )
  with check (
    bucket_id = 'family-media'
    and roots.can_edit(roots.family_from_object_path(name))
    and name like '%/derived/%'
  );

-- Deletes: admins only, and never an original.
create policy "family media delete derived only" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'family-media'
    and roots.family_from_object_path(name) is not null
    and roots.can_admin(roots.family_from_object_path(name))
    and name like '%/derived/%'
  );
