set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0003 · Places, people, couples, parent-child relationships
-- ----------------------------------------------------------------------------
-- Design note: a COUPLE is a first-class entity, not a derived pair. Children
-- attach to a couple, which is what lets the system infer parents, siblings,
-- half-siblings, grandparents and cousins without anyone typing them in.
-- A couple may have one known partner (person_b_id null) so that single parents
-- and "we don't know who the grandmother was" are representable rather than lost.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- locations — shared by people, events, memories and media
-- ---------------------------------------------------------------------------
create table locations (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 200),
  detail        text,                       -- soum / district / street
  admin_area    text,                       -- aimag / province / state
  country       text,
  country_code  char(2),
  latitude      double precision check (latitude between -90 and 90),
  longitude     double precision check (longitude between -180 and 180),
  -- Historical place names change. Keep what the family called it.
  historical_name text,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index locations_family_idx on locations (family_id);
create index locations_name_trgm_idx on locations using gin (name gin_trgm_ops);
create trigger locations_touch before update on locations
  for each row execute function roots.touch_updated_at();

-- ---------------------------------------------------------------------------
-- people
-- ---------------------------------------------------------------------------
create table people (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id) on delete cascade,

  -- Mongolian naming: given name is primary, "last_name" holds the father's
  -- name / clan name (овог). Both are free text so other naming systems fit.
  first_name      text not null check (length(btrim(first_name)) between 1 and 120),
  last_name       text check (last_name is null or length(btrim(last_name)) <= 120),
  nickname        text,
  -- Name exactly as written in an old document, in its original script.
  name_in_source  text,

  gender          gender_bucket not null default 'unknown',
  gender_label    text,          -- what the family actually calls it, displayed as-is

  birth_date      date,
  birth_date_precision date_precision not null default 'unknown',
  death_date      date,
  death_date_precision date_precision not null default 'unknown',
  life_status     life_status not null default 'unknown',

  birth_place_id  uuid references locations(id) on delete set null,
  death_place_id  uuid references locations(id) on delete set null,

  occupation      text,
  education       text,
  biography       text,

  profile_photo_media_id uuid,   -- FK added in 0005 once media exists

  -- Cached, never hand-edited. Recomputed from the relationship graph.
  -- 1 = oldest known ancestor in this family.
  generation      smallint,
  generation_computed_at timestamptz,

  -- People outside the visible window are archived, NEVER deleted.
  is_archived     boolean not null default false,

  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint people_death_after_birth check (
    birth_date is null or death_date is null or death_date >= birth_date
  ),
  constraint people_living_has_no_death check (
    life_status <> 'living' or death_date is null
  )
);

create index people_family_idx on people (family_id) where deleted_at is null;
create index people_generation_idx on people (family_id, generation) where deleted_at is null;
create index people_birth_idx on people (family_id, birth_date);
create index people_archived_idx on people (family_id, is_archived) where deleted_at is null;

-- Diacritic- and case-insensitive fuzzy search across the whole display name.
create index people_name_trgm_idx on people using gin (
  (coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(nickname,''))
  gin_trgm_ops
);

create trigger people_touch before update on people
  for each row execute function roots.touch_updated_at();

-- Keep life_status coherent with death_date without forcing the user to think.
create or replace function roots.sync_life_status()
returns trigger
language plpgsql
as $$
begin
  if new.death_date is not null then
    new.life_status := 'deceased';
  end if;
  return new;
end;
$$;

create trigger people_sync_life_status before insert or update of death_date on people
  for each row execute function roots.sync_life_status();

-- Now that people exists, close the loops left open in 0002.
alter table families
  add constraint families_root_person_fk
  foreign key (root_person_id) references people(id) on delete set null;

alter table family_members
  add constraint family_members_person_fk
  foreign key (person_id) references people(id) on delete set null;

alter table invitations
  add constraint invitations_person_fk
  foreign key (person_id) references people(id) on delete set null;

-- ---------------------------------------------------------------------------
-- person_locations — "places lived", with a time range
-- ---------------------------------------------------------------------------
create table person_locations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  person_id   uuid not null references people(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  kind        text not null default 'lived'
              check (kind in ('born','lived','worked','studied','died','buried','visited')),
  from_date   date,
  to_date     date,
  notes       text,
  source_id   uuid,          -- FK added in 0006
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint person_locations_range check (from_date is null or to_date is null or to_date >= from_date)
);

create index person_locations_person_idx on person_locations (person_id, from_date);
create index person_locations_location_idx on person_locations (location_id);

-- ---------------------------------------------------------------------------
-- couples
-- ---------------------------------------------------------------------------
create table couples (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references families(id) on delete cascade,
  person_a_id        uuid not null references people(id) on delete cascade,
  -- Null means "partner unknown / not recorded" — single parents and lost
  -- ancestors stay representable instead of being forced into a fiction.
  person_b_id        uuid references people(id) on delete cascade,

  relationship_type  couple_type not null default 'marriage',
  status             couple_status not null default 'unknown',
  relationship_start date,
  relationship_end   date,
  marriage_date      date,
  marriage_place_id  uuid references locations(id) on delete set null,
  story              text,          -- "how they met"
  source_id          uuid,          -- FK added in 0006

  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint couples_distinct_people check (person_b_id is null or person_a_id <> person_b_id),
  -- Canonical ordering makes (A,B) and (B,A) the same row, so the same couple
  -- can never be entered twice by two different relatives.
  constraint couples_canonical_order check (person_b_id is null or person_a_id < person_b_id),
  constraint couples_range check (
    relationship_start is null or relationship_end is null or relationship_end >= relationship_start
  )
);

create unique index couples_unique_pair_idx
  on couples (family_id, person_a_id, coalesce(person_b_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where deleted_at is null;

create index couples_family_idx on couples (family_id) where deleted_at is null;
create index couples_person_a_idx on couples (person_a_id) where deleted_at is null;
create index couples_person_b_idx on couples (person_b_id) where deleted_at is null;

create trigger couples_touch before update on couples
  for each row execute function roots.touch_updated_at();

-- Both partners must belong to the same family as the couple.
create or replace function roots.assert_couple_family()
returns trigger
language plpgsql
as $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from public.people p
  where p.id in (new.person_a_id, new.person_b_id)
    and p.family_id <> new.family_id;

  if v_bad > 0 then
    raise exception 'couple partners must belong to family %', new.family_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger couples_assert_family before insert or update on couples
  for each row execute function roots.assert_couple_family();

alter table families
  add constraint families_root_couple_fk
  foreign key (root_couple_id) references couples(id) on delete set null;

-- partner_relationships: a normalised, per-person view of couple membership.
-- It is a VIEW rather than a table on purpose — a second physical copy of the
-- same fact is a drift bug waiting to happen.
create view partner_relationships as
  select c.id::text || ':a' as id, c.id as couple_id, c.family_id, c.person_a_id as person_id,
         c.person_b_id as partner_id, 'a'::text as slot, c.relationship_type, c.status,
         c.relationship_start, c.relationship_end, c.marriage_date
  from couples c where c.deleted_at is null
  union all
  select c.id::text || ':b', c.id, c.family_id, c.person_b_id, c.person_a_id, 'b',
         c.relationship_type, c.status, c.relationship_start, c.relationship_end, c.marriage_date
  from couples c where c.deleted_at is null and c.person_b_id is not null;

-- ---------------------------------------------------------------------------
-- parent_child_relationships
-- ---------------------------------------------------------------------------
create table parent_child_relationships (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families(id) on delete cascade,
  parent_id         uuid not null references people(id) on delete cascade,
  child_id          uuid not null references people(id) on delete cascade,
  -- Which couple this child was added through. Set automatically when a child
  -- is added to a couple; it is what makes full-sibling vs half-sibling exact.
  couple_id         uuid references couples(id) on delete set null,
  relationship_type parent_child_type not null default 'biological',
  certainty         confidence_level not null default 'certain',
  source_id         uuid,          -- FK added in 0006
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint pcr_not_self check (parent_id <> child_id),
  unique (parent_id, child_id)
);

create index pcr_child_idx  on parent_child_relationships (child_id);
create index pcr_parent_idx on parent_child_relationships (parent_id);
create index pcr_couple_idx on parent_child_relationships (couple_id);
create index pcr_family_idx on parent_child_relationships (family_id);

create trigger pcr_touch before update on parent_child_relationships
  for each row execute function roots.touch_updated_at();

-- A person cannot be their own ancestor. Without this, one mis-click creates an
-- infinite loop that breaks generation calculation and the tree renderer.
create or replace function roots.assert_no_ancestor_cycle()
returns trigger
language plpgsql
as $$
declare
  v_cycle boolean;
begin
  if (select p.family_id from public.people p where p.id = new.parent_id) is distinct from new.family_id
     or (select p.family_id from public.people p where p.id = new.child_id) is distinct from new.family_id then
    raise exception 'parent and child must belong to family %', new.family_id using errcode = '23514';
  end if;

  -- Walk up from the proposed parent; if we reach the child, this edge closes a loop.
  select exists (
    with recursive ancestors(person_id, depth) as (
      select new.parent_id, 1
      union all
      select r.parent_id, a.depth + 1
      from public.parent_child_relationships r
      join ancestors a on r.child_id = a.person_id
      where a.depth < 64
    )
    select 1 from ancestors where person_id = new.child_id
  ) into v_cycle;

  if v_cycle then
    raise exception 'this would make % their own ancestor', new.child_id using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger pcr_assert_no_cycle before insert or update on parent_child_relationships
  for each row execute function roots.assert_no_ancestor_cycle();

-- A child should not end up with more than two biological parents.
create or replace function roots.assert_parent_count()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  if new.relationship_type = 'biological' then
    select count(*) into v_count
    from public.parent_child_relationships r
    where r.child_id = new.child_id
      and r.relationship_type = 'biological'
      and r.id <> new.id;
    if v_count >= 2 then
      raise exception 'a person can have at most two biological parents'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger pcr_assert_parent_count before insert or update on parent_child_relationships
  for each row execute function roots.assert_parent_count();
