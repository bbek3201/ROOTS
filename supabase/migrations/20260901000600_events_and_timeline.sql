set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0006 · Life events and family timeline
-- ----------------------------------------------------------------------------
-- Two distinct things, deliberately not one table:
--   life_events    — belong to a PERSON or a COUPLE ("married 1986", "born 1958")
--   timeline_events— belong to the FAMILY as a whole, spanning generations
--                    ("1990 — the family moved to Ulaanbaatar")
-- Individual, couple and family timelines are then all just filtered reads.
-- ============================================================================

create table life_events (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  -- Exactly one subject: a person or a couple.
  person_id      uuid references people(id) on delete cascade,
  couple_id      uuid references couples(id) on delete cascade,

  event_type     text not null default 'other' check (event_type in (
                   'birth','death','marriage','divorce','engagement','birth_of_child',
                   'graduation','education','job','military','migration','move','award',
                   'illness','religious','travel','retirement','other')),
  title          text not null check (length(btrim(title)) between 1 and 200),
  description    text,

  event_date     date,
  date_precision date_precision not null default 'unknown',
  end_date       date,

  location_id    uuid references locations(id) on delete set null,
  source_id      uuid,            -- FK added in 0008
  memory_id      uuid references memories(id) on delete set null,

  -- Events extracted by AI from an interview start unconfirmed. Nothing enters
  -- the timeline as fact until a human confirms it.
  is_ai_extracted boolean not null default false,
  confirmed_by   uuid references auth.users(id) on delete set null,
  confirmed_at   timestamptz,

  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint life_events_one_subject check (
    (person_id is not null and couple_id is null) or
    (person_id is null and couple_id is not null)
  ),
  constraint life_events_range check (end_date is null or event_date is null or end_date >= event_date)
);

create index life_events_person_idx on life_events (person_id, event_date nulls last)
  where deleted_at is null;
create index life_events_couple_idx on life_events (couple_id, event_date nulls last)
  where deleted_at is null;
create index life_events_family_idx on life_events (family_id, event_date desc nulls last)
  where deleted_at is null;
create index life_events_unconfirmed_idx on life_events (family_id)
  where is_ai_extracted and confirmed_at is null and deleted_at is null;

create trigger life_events_touch before update on life_events
  for each row execute function roots.touch_updated_at();

-- ---------------------------------------------------------------------------
-- timeline_events — family-scale history
-- ---------------------------------------------------------------------------
create table timeline_events (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  scope          text not null default 'family' check (scope in ('family','generation','world')),
  -- For scope='generation': which generation this belongs to.
  generation     smallint,
  title          text not null check (length(btrim(title)) between 1 and 200),
  description    text,
  event_date     date,
  date_precision date_precision not null default 'unknown',
  end_date       date,
  location_id    uuid references locations(id) on delete set null,
  source_id      uuid,            -- FK added in 0008
  is_milestone   boolean not null default false,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index timeline_events_family_idx on timeline_events (family_id, event_date nulls last)
  where deleted_at is null;

create trigger timeline_events_touch before update on timeline_events
  for each row execute function roots.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Automatic life events
-- ----------------------------------------------------------------------------
-- Users should not have to type "born 1958" after already entering a birth date.
-- Births, deaths and marriages become timeline entries by themselves, and stay
-- in sync when the underlying date is corrected.
-- ---------------------------------------------------------------------------
create or replace function roots.sync_person_life_events()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- Birth
  if new.birth_date is not null then
    insert into public.life_events (family_id, person_id, event_type, title, event_date,
                                    date_precision, location_id, created_by)
    select new.family_id, new.id, 'birth', 'Төрсөн', new.birth_date,
           new.birth_date_precision, new.birth_place_id, new.created_by
    where not exists (
      select 1 from public.life_events e
      where e.person_id = new.id and e.event_type = 'birth' and e.deleted_at is null
    );

    update public.life_events e
    set event_date = new.birth_date,
        date_precision = new.birth_date_precision,
        location_id = coalesce(new.birth_place_id, e.location_id)
    where e.person_id = new.id and e.event_type = 'birth' and e.deleted_at is null
      and e.event_date is distinct from new.birth_date;
  end if;

  -- Death
  if new.death_date is not null then
    insert into public.life_events (family_id, person_id, event_type, title, event_date,
                                    date_precision, location_id, created_by)
    select new.family_id, new.id, 'death', 'Таалал төгссөн', new.death_date,
           new.death_date_precision, new.death_place_id, new.created_by
    where not exists (
      select 1 from public.life_events e
      where e.person_id = new.id and e.event_type = 'death' and e.deleted_at is null
    );

    update public.life_events e
    set event_date = new.death_date,
        date_precision = new.death_date_precision
    where e.person_id = new.id and e.event_type = 'death' and e.deleted_at is null
      and e.event_date is distinct from new.death_date;
  end if;

  return null;
end;
$$;

create trigger people_sync_life_events
  after insert or update of birth_date, death_date, birth_place_id, death_place_id on people
  for each row execute function roots.sync_person_life_events();

create or replace function roots.sync_couple_life_events()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if new.marriage_date is not null then
    insert into public.life_events (family_id, couple_id, event_type, title, event_date,
                                    location_id, date_precision, created_by)
    select new.family_id, new.id, 'marriage', 'Гэрлэсэн', new.marriage_date,
           new.marriage_place_id, 'exact', new.created_by
    where not exists (
      select 1 from public.life_events e
      where e.couple_id = new.id and e.event_type = 'marriage' and e.deleted_at is null
    );

    update public.life_events e
    set event_date = new.marriage_date,
        location_id = coalesce(new.marriage_place_id, e.location_id)
    where e.couple_id = new.id and e.event_type = 'marriage' and e.deleted_at is null
      and e.event_date is distinct from new.marriage_date;
  end if;
  return null;
end;
$$;

create trigger couples_sync_life_events
  after insert or update of marriage_date, marriage_place_id on couples
  for each row execute function roots.sync_couple_life_events();

-- A person's full chronological timeline: their own events, the events of every
-- couple they belong to, and the memories they appear in — one ordered stream.
create view person_timeline as
  select e.family_id, e.person_id, e.id as entry_id, 'life_event'::text as entry_kind,
         e.event_type, e.title, e.description, e.event_date, e.date_precision,
         e.location_id, e.is_ai_extracted, e.confirmed_at, e.created_at
  from life_events e
  where e.person_id is not null and e.deleted_at is null
  union all
  select e.family_id, pr.person_id, e.id, 'couple_event',
         e.event_type, e.title, e.description, e.event_date, e.date_precision,
         e.location_id, e.is_ai_extracted, e.confirmed_at, e.created_at
  from life_events e
  join partner_relationships pr on pr.couple_id = e.couple_id
  where e.couple_id is not null and e.deleted_at is null
  union all
  select m.family_id, mp.person_id, m.id, 'memory',
         m.type::text, m.title, m.description, m.memory_date, m.date_precision,
         m.location_id, false, null::timestamptz, m.created_at
  from memories m
  join memory_people mp on mp.memory_id = m.id
  where m.deleted_at is null;
