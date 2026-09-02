set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0005 · Memory archive, media, and the originals guarantee
-- ----------------------------------------------------------------------------
-- media uses class-table inheritance: one `media` supertype row holds the facts
-- every file has (path, size, uploader, family), and photos/videos/
-- audio_recordings/documents hold what only that kind has. This keeps queries
-- like "everything on this person's profile" a single scan instead of a
-- four-way union, while keeping the type-specific columns properly normalised.
--
-- THE ORIGINALS RULE: a row with variant='original' is immutable. Restoring,
-- colorising or cropping always writes a NEW row pointing back via
-- derived_from_id. A database trigger enforces it, so no future code path can
-- quietly break the promise.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- memories
-- ---------------------------------------------------------------------------
create table memories (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  type           memory_type not null default 'story',
  title          text not null check (length(btrim(title)) between 1 and 200),
  description    text,
  -- The story as told. Free text, in whatever language the teller used.
  body           text,
  memory_date    date,
  date_precision date_precision not null default 'unknown',
  -- Some memories are a span ("the summers we spent at the ail").
  end_date       date,
  location_id    uuid references locations(id) on delete set null,
  -- Who gave this memory to the archive. Attribution is permanent.
  contributor_id uuid references auth.users(id) on delete set null,
  -- Snapshot of the contributor's name so attribution survives account deletion.
  contributor_name text not null,
  -- Optional couple context, e.g. a memory about a marriage.
  couple_id      uuid references couples(id) on delete set null,
  is_private     boolean not null default false,   -- visible to admins + contributor only
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint memories_range check (end_date is null or memory_date is null or end_date >= memory_date)
);

create index memories_family_idx on memories (family_id, memory_date desc nulls last)
  where deleted_at is null;
create index memories_recent_idx on memories (family_id, created_at desc) where deleted_at is null;
create index memories_contributor_idx on memories (contributor_id);
create index memories_location_idx on memories (location_id);
create index memories_search_idx on memories using gin (
  (coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(body,'')) gin_trgm_ops
);

create trigger memories_touch before update on memories
  for each row execute function roots.touch_updated_at();

-- ---------------------------------------------------------------------------
-- memory_people — a memory can involve any number of people
-- ---------------------------------------------------------------------------
create table memory_people (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  memory_id  uuid not null references memories(id) on delete cascade,
  person_id  uuid not null references people(id) on delete cascade,
  -- How this person relates to the memory: are they in it, did they tell it,
  -- are they merely mentioned? Free-ish but constrained for query sanity.
  role       text not null default 'subject'
             check (role in ('subject','present','mentioned','narrator','author','recipient')),
  note       text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (memory_id, person_id, role)
);

create index memory_people_person_idx on memory_people (person_id);
create index memory_people_memory_idx on memory_people (memory_id);

-- Compatibility view: "all memories attached to a person", the direction the
-- person profile reads from.
create view person_memory_links as
  select mp.id, mp.family_id, mp.person_id, mp.memory_id, mp.role, mp.created_at,
         m.type, m.title, m.memory_date, m.contributor_id
  from memory_people mp
  join memories m on m.id = mp.memory_id and m.deleted_at is null;

-- ---------------------------------------------------------------------------
-- media (supertype)
-- ---------------------------------------------------------------------------
create table media (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id) on delete cascade,
  kind            media_kind not null,
  variant         media_variant not null default 'original',

  -- Storage always lives under families/{family_id}/... in a PRIVATE bucket.
  storage_bucket  text not null default 'family-media',
  storage_path    text not null,
  original_filename text,
  mime_type       text,
  size_bytes      bigint check (size_bytes is null or size_bytes >= 0),
  checksum_sha256 text,

  -- Derived files point back at the file they came from. Originals point at null.
  derived_from_id uuid references media(id) on delete restrict,
  -- What produced this derivative, so "restored by AI" is never mistaken for
  -- the original photograph.
  generated_by    text,

  width           integer,
  height          integer,
  duration_seconds numeric(10,2),

  caption         text,
  taken_at        timestamptz,
  taken_date_precision date_precision not null default 'unknown',
  location_id     uuid references locations(id) on delete set null,

  -- Optional direct attachments (a profile photo, a couple's wedding photo).
  memory_id       uuid references memories(id) on delete cascade,
  person_id       uuid references people(id) on delete cascade,
  couple_id       uuid references couples(id) on delete cascade,

  uploaded_by     uuid references auth.users(id) on delete set null,
  uploaded_by_name text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  unique (storage_bucket, storage_path),
  constraint media_original_has_no_parent check (
    (variant = 'original' and derived_from_id is null) or
    (variant <> 'original' and derived_from_id is not null)
  )
);

create index media_family_idx   on media (family_id, created_at desc) where deleted_at is null;
create index media_memory_idx   on media (memory_id) where deleted_at is null;
create index media_person_idx   on media (person_id) where deleted_at is null;
create index media_couple_idx   on media (couple_id) where deleted_at is null;
create index media_derived_idx  on media (derived_from_id);
create index media_kind_idx     on media (family_id, kind, variant) where deleted_at is null;

create trigger media_touch before update on media
  for each row execute function roots.touch_updated_at();

-- The originals guarantee, enforced by the database rather than by convention.
create or replace function roots.protect_original_media()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.variant = 'original' then
    if new.storage_path is distinct from old.storage_path
       or new.storage_bucket is distinct from old.storage_bucket
       or new.checksum_sha256 is distinct from old.checksum_sha256
       or new.variant is distinct from old.variant then
      raise exception 'original media is immutable; create a derived version instead'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' and old.variant = 'original' then
    raise exception 'original media cannot be hard-deleted; set deleted_at instead'
      using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger media_protect_original
  before update or delete on media
  for each row execute function roots.protect_original_media();

-- Now people can point at their profile photo.
alter table people
  add constraint people_profile_photo_fk
  foreign key (profile_photo_media_id) references media(id) on delete set null;

-- ---------------------------------------------------------------------------
-- media subtypes
-- ---------------------------------------------------------------------------
create table photos (
  media_id      uuid primary key references media(id) on delete cascade,
  family_id     uuid not null references families(id) on delete cascade,
  is_scanned    boolean not null default false,   -- scan of a physical print
  is_colorized  boolean not null default false,
  is_restored   boolean not null default false,
  orientation   smallint,
  camera        text,
  -- AI photo understanding output lives in ai_outputs; this is just the flag.
  analysis_status processing_status not null default 'pending'
);

create table videos (
  media_id      uuid primary key references media(id) on delete cascade,
  family_id     uuid not null references families(id) on delete cascade,
  resolution    text,
  has_audio     boolean not null default true,
  transcript_status processing_status not null default 'pending'
);

create table audio_recordings (
  media_id        uuid primary key references media(id) on delete cascade,
  family_id       uuid not null references families(id) on delete cascade,
  -- Whose voice this is. The single most emotionally valuable column in ROOTS.
  speaker_person_id uuid references people(id) on delete set null,
  recorded_at     timestamptz,
  interview_id    uuid,          -- FK added in 0007
  language        text default 'mn',
  transcript_status processing_status not null default 'pending',
  -- Voice cloning is opt-in, off, and recorded explicitly. ROOTS never clones a
  -- voice automatically; this column exists so consent is auditable.
  voice_cloning_consent boolean not null default false,
  consent_recorded_by uuid references auth.users(id) on delete set null,
  consent_recorded_at timestamptz
);

create table documents (
  media_id      uuid primary key references media(id) on delete cascade,
  family_id     uuid not null references families(id) on delete cascade,
  doc_type      document_type not null default 'other',
  page_count    integer,
  language      text,
  ocr_status    processing_status not null default 'pending',
  ocr_text      text
);

create index documents_ocr_trgm_idx on documents using gin (ocr_text gin_trgm_ops);
create index audio_speaker_idx on audio_recordings (speaker_person_id);

-- ---------------------------------------------------------------------------
-- photo_people_tags — identify who is in an old photograph.
-- Once confirmed, the photo appears on that person's profile automatically
-- (see the person_photos view below).
-- ---------------------------------------------------------------------------
create table photo_people_tags (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  media_id     uuid not null references media(id) on delete cascade,
  person_id    uuid not null references people(id) on delete cascade,
  -- Normalised face box (0..1) so it survives any resizing.
  box_x        numeric(6,5) check (box_x between 0 and 1),
  box_y        numeric(6,5) check (box_y between 0 and 1),
  box_width    numeric(6,5) check (box_width between 0 and 1),
  box_height   numeric(6,5) check (box_height between 0 and 1),
  -- Suggested by AI vs confirmed by a human. Unconfirmed tags never count as fact.
  suggested_by_ai boolean not null default false,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (media_id, person_id)
);

create index photo_tags_person_idx on photo_people_tags (person_id) where confirmed_at is not null;
create index photo_tags_media_idx on photo_people_tags (media_id);

-- Everything that should show on a person's photo wall: photos they are tagged
-- in, photos attached directly to them, and photos from memories they are in.
create view person_photos as
  with candidates as (
    select t.person_id, m.id as media_id, m.family_id, m.storage_bucket, m.storage_path,
           m.variant, m.caption, m.taken_at, 'tagged'::text as via, 1 as priority
    from photo_people_tags t
    join media m on m.id = t.media_id
    where t.confirmed_at is not null and m.deleted_at is null and m.kind = 'photo'
    union all
    select m.person_id, m.id, m.family_id, m.storage_bucket, m.storage_path,
           m.variant, m.caption, m.taken_at, 'attached', 2
    from media m
    where m.person_id is not null and m.kind = 'photo' and m.deleted_at is null
    union all
    select mp.person_id, m.id, m.family_id, m.storage_bucket, m.storage_path,
           m.variant, m.caption, m.taken_at, 'memory', 3
    from memory_people mp
    join media m on m.memory_id = mp.memory_id
    where m.kind = 'photo' and m.deleted_at is null
  )
  -- The same photo can reach a person by more than one route; keep the strongest.
  select distinct on (person_id, media_id)
         person_id, media_id, family_id, storage_bucket, storage_path,
         variant, caption, taken_at, via
  from candidates
  order by person_id, media_id, priority;
