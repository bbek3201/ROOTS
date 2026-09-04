-- ROOTS — full schema, all migrations concatenated in order.
-- Generated from supabase/migrations. Paste into the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query) and run once, or use `supabase db push`.
--
-- If a re-run fails with "... already exists", a previous attempt committed
-- part of the schema. Uncomment the four lines below to wipe the app schema
-- first. THEY DELETE EVERY TABLE IN `public` — only ever run them on a project
-- that holds no family data you want to keep.
--
--   drop schema if exists roots cascade;
--   drop schema public cascade;
--   create schema public;
--   grant usage, create on schema public to postgres, anon, authenticated, service_role;

-- ======================================================================
-- 20260901000100_extensions_and_enums.sql
-- ======================================================================

set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0001 · Extensions, enums, shared utilities
-- ----------------------------------------------------------------------------
-- Every enum here is deliberately open at the edges: kinship, gender and event
-- vocabularies differ between cultures, so values that vary are stored as enum
-- values ONLY where the application logic must branch on them. Anything that is
-- purely descriptive (relationship labels, event titles, appearance vocabulary)
-- stays free text so no cultural assumption is baked into the database.
-- ============================================================================

-- Supabase keeps extensions out of `public`. Creating them here explicitly means
-- the migrations run identically on a bare Postgres and on a hosted project.
create schema if not exists extensions;
grant usage on schema extensions to authenticated, anon, service_role;

create extension if not exists "pgcrypto" with schema extensions;  -- digest(), gen_random_bytes()
create extension if not exists "pg_trgm"  with schema extensions;  -- fuzzy name search
create extension if not exists "unaccent" with schema extensions;  -- diacritic-insensitive search

-- Private schema for helper functions that must never be exposed via PostgREST.
create schema if not exists roots;
revoke all on schema roots from public, anon, authenticated;
grant usage on schema roots to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Membership & permissions
-- ---------------------------------------------------------------------------
create type family_role as enum (
  'owner',        -- full control incl. deleting the family; exactly one per family
  'admin',        -- manage members, invitations, all content
  'editor',       -- create/edit people, couples, relationships, memories
  'contributor',  -- add memories/media/interviews; edit only their own contributions
  'viewer'        -- read-only
);

create type membership_status as enum ('active', 'invited', 'suspended', 'left');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
-- Gender is stored as a free-form label plus a coarse bucket. The bucket is the
-- only thing kinship-term logic may branch on; the label is what we display.
create type gender_bucket as enum ('male', 'female', 'other', 'unknown');

create type life_status as enum ('living', 'deceased', 'unknown');

-- Historical dates are frequently partial ("about 1912", "spring 1940").
create type date_precision as enum ('exact', 'month', 'year', 'decade', 'about', 'unknown');

-- ---------------------------------------------------------------------------
-- Relationships
-- ---------------------------------------------------------------------------
create type parent_child_type as enum (
  'biological', 'adoptive', 'step', 'foster', 'guardian', 'unknown'
);

create type couple_type as enum (
  'marriage', 'partnership', 'engagement', 'unknown'
);

create type couple_status as enum (
  'together', 'separated', 'divorced', 'widowed', 'ended', 'unknown'
);

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------
create type memory_type as enum (
  'story', 'photo', 'video', 'audio', 'document', 'letter', 'recipe',
  'tradition', 'event', 'note'
);

create type media_kind as enum ('photo', 'video', 'audio', 'document');

-- Originals are sacred. Derived files are always NEW rows pointing back at the
-- original via media.derived_from_id — nothing is ever overwritten in place.
create type media_variant as enum (
  'original', 'thumbnail', 'web', 'restored', 'colorized', 'enhanced', 'cropped', 'transcoded'
);

create type document_type as enum (
  'letter', 'certificate', 'id_document', 'record', 'newspaper', 'diary', 'other'
);

create type processing_status as enum ('pending', 'running', 'done', 'failed', 'skipped');

-- ---------------------------------------------------------------------------
-- Provenance
-- ---------------------------------------------------------------------------
create type source_type as enum (
  'family_interview', 'photograph', 'document', 'relative', 'user_entry',
  'official_record', 'gravestone', 'external', 'unknown'
);

create type claim_status as enum ('active', 'disputed', 'superseded', 'retracted');

create type confidence_level as enum ('certain', 'probable', 'uncertain', 'disputed');

-- ---------------------------------------------------------------------------
-- Interviews & AI
-- ---------------------------------------------------------------------------
create type interview_status as enum ('draft', 'in_progress', 'paused', 'completed', 'archived');

create type ai_task as enum (
  'transcribe', 'summarize', 'extract_timeline', 'analyze_photo', 'ocr',
  'answer_question', 'generate_story', 'organize_appearance', 'embed'
);

-- Where a piece of appearance information came from. The UI MUST render these
-- three differently — a verified photograph is not a family memory, and neither
-- is an AI-organised summary.
create type appearance_source as enum (
  'photograph',          -- verified: derived from a real photo of this person
  'family_description',  -- a relative described them from memory
  'ai_summary'           -- AI reorganisation of family descriptions (never a new fact)
);

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest
-- ---------------------------------------------------------------------------
create or replace function roots.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ======================================================================
-- 20260901000200_identity_families_access.sql
-- ======================================================================

set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0002 · Identity, families, membership, invitations, audit
-- ----------------------------------------------------------------------------
-- The whole security model hangs off ONE rule: every row that belongs to a
-- family carries family_id, and every policy asks roots.is_member(family_id).
-- There is no other way in. Changing an id in a URL can therefore never reach
-- another family's data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user (app-level identity, not family-scoped)
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (length(btrim(display_name)) between 1 and 120),
  avatar_url    text,
  locale        text not null default 'mn' check (locale ~ '^[a-z]{2}(-[A-Za-z0-9]{2,8})*$'),
  timezone      text not null default 'Asia/Ulaanbaatar',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_touch before update on profiles
  for each row execute function roots.touch_updated_at();

-- Auto-create a profile when a user signs up so the app never has a userless state.
create or replace function roots.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'family member'), '@', 1)
    ),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'mn')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- auth.users survives a `drop schema public`, so this trigger must be
-- replaceable rather than create-once.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function roots.handle_new_user();

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------
create table families (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) between 1 and 160),
  description     text,
  -- The couple the tree opens on. Nullable at creation, set once a couple exists.
  root_couple_id  uuid,
  root_person_id  uuid,
  -- How many generations the main interface shows. Older generations are never
  -- deleted — they move into the archive (see people.is_archived).
  visible_generations smallint not null default 7
    check (visible_generations between 3 and 12),
  default_locale  text not null default 'mn',
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create trigger families_touch before update on families
  for each row execute function roots.touch_updated_at();

-- ---------------------------------------------------------------------------
-- family_members — the join between an auth user and a family, with a role
-- ---------------------------------------------------------------------------
create table family_members (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        family_role not null default 'viewer',
  status      membership_status not null default 'active',
  -- Which person in the tree IS this user. Lets us answer "how am I related to X".
  person_id   uuid,
  invited_by  uuid references auth.users(id) on delete set null,
  joined_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (family_id, user_id)
);

create index family_members_user_idx   on family_members (user_id) where status = 'active';
create index family_members_family_idx on family_members (family_id, role);
create unique index family_members_one_owner_idx
  on family_members (family_id) where role = 'owner' and status = 'active';

create trigger family_members_touch before update on family_members
  for each row execute function roots.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER so RLS policies can use them without
-- recursing into family_members' own policies).
-- ---------------------------------------------------------------------------
create or replace function roots.is_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.family_members m
    where m.family_id = p_family_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function roots.role_in(p_family_id uuid)
returns family_role
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select m.role from public.family_members m
  where m.family_id = p_family_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

-- Numeric rank makes "at least this powerful" checks trivial and total.
create or replace function roots.role_rank(p_role family_role)
returns smallint
language sql
immutable
as $$
  select case p_role
    when 'owner' then 5
    when 'admin' then 4
    when 'editor' then 3
    when 'contributor' then 2
    when 'viewer' then 1
    else 0
  end::smallint;
$$;

create or replace function roots.has_role_at_least(p_family_id uuid, p_min family_role)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select coalesce(roots.role_rank(roots.role_in(p_family_id)), 0) >= roots.role_rank(p_min);
$$;

-- Convenience wrappers used throughout the policies.
create or replace function roots.can_admin(p_family_id uuid) returns boolean
  language sql stable as $$ select roots.has_role_at_least(p_family_id, 'admin'); $$;

create or replace function roots.can_edit(p_family_id uuid) returns boolean
  language sql stable as $$ select roots.has_role_at_least(p_family_id, 'editor'); $$;

create or replace function roots.can_contribute(p_family_id uuid) returns boolean
  language sql stable as $$ select roots.has_role_at_least(p_family_id, 'contributor'); $$;

-- The person row representing the current user inside a given family.
create or replace function roots.my_person_id(p_family_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select m.person_id from public.family_members m
  where m.family_id = p_family_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- permissions — optional fine-grained grants layered on top of the role.
-- A capability grant can only ever ADD access, never remove it, and is always
-- scoped to one family.
-- ---------------------------------------------------------------------------
create table permissions (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  member_id     uuid not null references family_members(id) on delete cascade,
  capability    text not null check (capability in (
                  'manage_members','manage_invitations','edit_people','edit_relationships',
                  'edit_memories','delete_memories','run_interviews','export_family',
                  'view_archive','use_ai')),
  resource_type text,            -- null = family-wide
  resource_id   uuid,
  granted_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (member_id, capability, resource_type, resource_id)
);

create index permissions_member_idx on permissions (member_id, capability);

create or replace function roots.has_capability(p_family_id uuid, p_capability text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.permissions p
    join public.family_members m on m.id = p.member_id
    where p.family_id = p_family_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and p.capability = p_capability
  );
$$;

-- ---------------------------------------------------------------------------
-- invitations — token is stored ONLY as a sha256 hash. The plaintext token
-- exists exactly once, in the invitation link handed to the invitee.
-- ---------------------------------------------------------------------------
create table invitations (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families(id) on delete cascade,
  email        text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role         family_role not null default 'contributor',
  token_hash   text not null unique,
  -- Optionally pre-link the invitee to a person already in the tree.
  person_id    uuid,
  message      text,
  invited_by   uuid references auth.users(id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id) on delete set null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  constraint invitation_role_not_owner check (role <> 'owner'),
  constraint invitation_terminal_state check (
    not (accepted_at is not null and revoked_at is not null)
  )
);

create index invitations_family_idx on invitations (family_id, created_at desc);
create index invitations_open_idx on invitations (token_hash)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- audit_logs — append-only. No UPDATE or DELETE policy is ever granted.
-- ---------------------------------------------------------------------------
create table audit_logs (
  id            bigserial primary key,
  family_id     uuid references families(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action        text not null,
  resource_type text,
  resource_id   uuid,
  metadata      jsonb not null default '{}'::jsonb,
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index audit_logs_family_idx on audit_logs (family_id, created_at desc);
create index audit_logs_resource_idx on audit_logs (resource_type, resource_id);
create index audit_logs_actor_idx on audit_logs (actor_user_id, created_at desc);

create or replace function roots.log_audit(
  p_family_id uuid,
  p_action text,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.audit_logs (family_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (p_family_id, auth.uid(), p_action, p_resource_type, p_resource_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- create_family — creating a family and becoming its owner must be atomic,
-- otherwise a failure halfway leaves an orphan family nobody can reach.
-- ---------------------------------------------------------------------------
create or replace function public.create_family(
  p_name text,
  p_description text default null,
  p_locale text default 'mn'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_family_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'family name is required' using errcode = '22023';
  end if;

  insert into public.families (name, description, default_locale, created_by)
  values (btrim(p_name), nullif(btrim(p_description), ''), coalesce(p_locale, 'mn'), v_user_id)
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, role, status)
  values (v_family_id, v_user_id, 'owner', 'active');

  perform roots.log_audit(v_family_id, 'family.created', 'family', v_family_id,
                          jsonb_build_object('name', btrim(p_name)));

  return v_family_id;
end;
$$;

revoke all on function public.create_family(text, text, text) from public, anon;
grant execute on function public.create_family(text, text, text) to authenticated;

-- ======================================================================
-- 20260901000300_people_places_relationships.sql
-- ======================================================================

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

-- ======================================================================
-- 20260901000400_generation_engine.sql
-- ======================================================================

set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0004 · Generation calculation + relationship write RPCs
-- ----------------------------------------------------------------------------
-- Generation is NEVER typed in by a user. It is derived from the relationship
-- graph: generation 1 is the oldest known ancestor, and every child is exactly
-- one deeper than its deepest known parent. A partner who married in inherits
-- their partner's generation so couples always sit on the same row of the tree.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- roots.recompute_generations(family)
-- ---------------------------------------------------------------------------
create or replace function roots.recompute_generations(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_iteration integer := 0;
  v_changed integer;
  v_couple_rows integer;
  v_child_rows integer;
begin
  -- Everyone starts at generation 1 and is pushed DOWN by two rules applied
  -- until nothing moves:
  --   1. a child sits at least one row below its deepest parent
  --   2. partners sit on the SAME row
  --
  -- Rule 2 is why this is a relaxation and not a single recursive descent: a
  -- partner who married in has no parents recorded here, so a descent-only
  -- pass would leave them at generation 1, floating a whole row above their
  -- own spouse. Values only ever increase and the parent graph is acyclic
  -- (enforced by roots.assert_no_ancestor_cycle), so this terminates.
  update public.people
  set generation = 1, generation_computed_at = now()
  where family_id = p_family_id and deleted_at is null;

  loop
    v_iteration := v_iteration + 1;
    exit when v_iteration > 64;
    v_changed := 0;

    -- Rule 2: level up both partners of every couple.
    with pair_depth as (
      select c.person_a_id, c.person_b_id,
             greatest(pa.generation, pb.generation) as generation
      from public.couples c
      join public.people pa on pa.id = c.person_a_id
      join public.people pb on pb.id = c.person_b_id
      where c.family_id = p_family_id
        and c.deleted_at is null
        and c.person_b_id is not null
    ),
    levelled as (
      select person_a_id as person_id, generation from pair_depth
      union all
      select person_b_id, generation from pair_depth
    ),
    target as (
      select person_id, max(generation) as generation
      from levelled group by person_id
    )
    update public.people p
    set generation = t.generation, generation_computed_at = now()
    from target t
    where p.id = t.person_id and p.generation < t.generation;

    get diagnostics v_couple_rows = row_count;

    -- Rule 1: push every child below its deepest parent.
    with target as (
      select r.child_id, max(parent.generation) + 1 as generation
      from public.parent_child_relationships r
      join public.people parent on parent.id = r.parent_id
      where r.family_id = p_family_id
      group by r.child_id
    )
    update public.people p
    set generation = t.generation, generation_computed_at = now()
    from target t
    where p.id = t.child_id and p.generation < t.generation;

    get diagnostics v_child_rows = row_count;

    v_changed := v_couple_rows + v_child_rows;
    exit when v_changed = 0;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recompute automatically whenever the graph changes. Bulk importers can set
-- `select set_config('roots.defer_generations','on',true)` inside their
-- transaction and call roots.recompute_generations() once at the end.
-- ---------------------------------------------------------------------------
create or replace function roots.trigger_recompute_generations()
returns trigger
language plpgsql
as $$
declare
  v_family_id uuid;
begin
  if coalesce(current_setting('roots.defer_generations', true), 'off') = 'on' then
    return null;
  end if;

  -- OLD is unassigned on INSERT and NEW on DELETE, so each branch is explicit.
  if tg_op = 'DELETE' then
    v_family_id := old.family_id;
  else
    v_family_id := new.family_id;
  end if;

  if v_family_id is not null then
    perform roots.recompute_generations(v_family_id);
  end if;
  return null;
end;
$$;

create trigger pcr_recompute_generations
  after insert or update or delete on parent_child_relationships
  for each row execute function roots.trigger_recompute_generations();

create trigger couples_recompute_generations
  after insert or update or delete on couples
  for each row execute function roots.trigger_recompute_generations();

-- ---------------------------------------------------------------------------
-- Write RPCs
-- ----------------------------------------------------------------------------
-- These exist so the client never has to know about canonical uuid ordering,
-- never has to create two parent_child rows by hand, and can never half-commit
-- a relationship. Every one of them re-checks permission server-side.
-- ---------------------------------------------------------------------------

create or replace function roots.require_edit(p_family_id uuid)
returns void
language plpgsql
stable
as $$
begin
  if not roots.can_edit(p_family_id) then
    raise exception 'insufficient permission for family %', p_family_id using errcode = '42501';
  end if;
end;
$$;

-- add_person ---------------------------------------------------------------
create or replace function public.add_person(
  p_family_id uuid,
  p_first_name text,
  p_last_name text default null,
  p_gender gender_bucket default 'unknown',
  p_birth_date date default null,
  p_death_date date default null,
  p_nickname text default null,
  p_birth_place_id uuid default null,
  p_occupation text default null,
  p_biography text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_person_id uuid;
begin
  perform roots.require_edit(p_family_id);

  insert into public.people (
    family_id, first_name, last_name, nickname, gender, birth_date, death_date,
    birth_place_id, occupation, biography, created_by,
    birth_date_precision, death_date_precision
  )
  values (
    p_family_id, btrim(p_first_name), nullif(btrim(p_last_name), ''), nullif(btrim(p_nickname), ''),
    coalesce(p_gender, 'unknown'), p_birth_date, p_death_date,
    p_birth_place_id, nullif(btrim(p_occupation), ''), nullif(btrim(p_biography), ''), auth.uid(),
    case when p_birth_date is null then 'unknown' else 'exact' end,
    case when p_death_date is null then 'unknown' else 'exact' end
  )
  returning id into v_person_id;

  perform roots.recompute_generations(p_family_id);
  perform roots.log_audit(p_family_id, 'person.created', 'person', v_person_id,
                          jsonb_build_object('name', btrim(p_first_name)));
  return v_person_id;
end;
$$;

-- create_couple ------------------------------------------------------------
-- Accepts the two people in ANY order and stores them canonically.
create or replace function public.create_couple(
  p_family_id uuid,
  p_person_one uuid,
  p_person_two uuid default null,
  p_relationship_type couple_type default 'marriage',
  p_marriage_date date default null,
  p_relationship_start date default null,
  p_status couple_status default 'unknown'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_a uuid;
  v_b uuid;
  v_couple_id uuid;
begin
  perform roots.require_edit(p_family_id);

  if p_person_one is null then
    raise exception 'at least one partner is required' using errcode = '22023';
  end if;

  if p_person_two is null then
    v_a := p_person_one;
    v_b := null;
  else
    v_a := least(p_person_one, p_person_two);
    v_b := greatest(p_person_one, p_person_two);
  end if;

  -- Idempotent: re-adding the same couple returns the existing one rather than
  -- failing, because two relatives will inevitably try to add it twice.
  select c.id into v_couple_id
  from public.couples c
  where c.family_id = p_family_id
    and c.person_a_id = v_a
    and c.person_b_id is not distinct from v_b
    and c.deleted_at is null;

  if v_couple_id is not null then
    return v_couple_id;
  end if;

  insert into public.couples (
    family_id, person_a_id, person_b_id, relationship_type,
    marriage_date, relationship_start, status, created_by
  )
  values (
    p_family_id, v_a, v_b, coalesce(p_relationship_type, 'marriage'),
    p_marriage_date, coalesce(p_relationship_start, p_marriage_date),
    coalesce(p_status, 'unknown'), auth.uid()
  )
  returning id into v_couple_id;

  perform roots.log_audit(p_family_id, 'couple.created', 'couple', v_couple_id, '{}'::jsonb);
  return v_couple_id;
end;
$$;

-- link_child_to_couple -----------------------------------------------------
-- THE core operation. One call wires the child to BOTH partners, which is what
-- makes siblings, grandparents, aunts, uncles and cousins fall out for free.
create or replace function public.link_child_to_couple(
  p_couple_id uuid,
  p_child_id uuid,
  p_relationship_type parent_child_type default 'biological'
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_couple couples%rowtype;
begin
  select * into v_couple from public.couples where id = p_couple_id and deleted_at is null;
  if not found then
    raise exception 'couple % not found', p_couple_id using errcode = 'P0002';
  end if;

  perform roots.require_edit(v_couple.family_id);

  if not exists (
    select 1 from public.people p
    where p.id = p_child_id and p.family_id = v_couple.family_id and p.deleted_at is null
  ) then
    raise exception 'child does not belong to this family' using errcode = '23514';
  end if;

  insert into public.parent_child_relationships
    (family_id, parent_id, child_id, couple_id, relationship_type, created_by)
  values
    (v_couple.family_id, v_couple.person_a_id, p_child_id, p_couple_id,
     coalesce(p_relationship_type, 'biological'), auth.uid())
  on conflict (parent_id, child_id) do update
    set couple_id = excluded.couple_id;

  if v_couple.person_b_id is not null then
    insert into public.parent_child_relationships
      (family_id, parent_id, child_id, couple_id, relationship_type, created_by)
    values
      (v_couple.family_id, v_couple.person_b_id, p_child_id, p_couple_id,
       coalesce(p_relationship_type, 'biological'), auth.uid())
    on conflict (parent_id, child_id) do update
      set couple_id = excluded.couple_id;
  end if;

  perform roots.recompute_generations(v_couple.family_id);
  perform roots.log_audit(v_couple.family_id, 'couple.child_linked', 'couple', p_couple_id,
                          jsonb_build_object('child_id', p_child_id));
end;
$$;

-- add_child_to_couple ------------------------------------------------------
-- Create the person AND wire the relationships in a single transaction.
create or replace function public.add_child_to_couple(
  p_couple_id uuid,
  p_first_name text,
  p_last_name text default null,
  p_gender gender_bucket default 'unknown',
  p_birth_date date default null,
  p_nickname text default null,
  p_relationship_type parent_child_type default 'biological'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_couple couples%rowtype;
  v_child_id uuid;
  v_inherited_last_name text;
begin
  select * into v_couple from public.couples where id = p_couple_id and deleted_at is null;
  if not found then
    raise exception 'couple % not found', p_couple_id using errcode = 'P0002';
  end if;

  perform roots.require_edit(v_couple.family_id);

  -- Mongolian convention: a child's овог follows the father's given name. We
  -- only PREFILL it when the caller gave nothing, and it stays fully editable —
  -- the rule differs between families, so it is a default, never a constraint.
  if p_last_name is null then
    select p.first_name into v_inherited_last_name
    from public.people p
    where p.id in (v_couple.person_a_id, v_couple.person_b_id)
      and p.gender = 'male'
    order by p.birth_date nulls last
    limit 1;
  end if;

  insert into public.people (
    family_id, first_name, last_name, nickname, gender, birth_date,
    birth_date_precision, created_by
  )
  values (
    v_couple.family_id, btrim(p_first_name),
    coalesce(nullif(btrim(p_last_name), ''), v_inherited_last_name),
    nullif(btrim(p_nickname), ''), coalesce(p_gender, 'unknown'), p_birth_date,
    case when p_birth_date is null then 'unknown' else 'exact' end,
    auth.uid()
  )
  returning id into v_child_id;

  perform public.link_child_to_couple(p_couple_id, v_child_id, p_relationship_type);
  return v_child_id;
end;
$$;

-- add_parents_to_person ----------------------------------------------------
-- Growing the tree UPWARD: attach a new couple above an existing person.
create or replace function public.add_parent_couple(
  p_family_id uuid,
  p_child_id uuid,
  p_parent_one_id uuid,
  p_parent_two_id uuid default null,
  p_marriage_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_couple_id uuid;
begin
  perform roots.require_edit(p_family_id);
  v_couple_id := public.create_couple(p_family_id, p_parent_one_id, p_parent_two_id,
                                      'marriage', p_marriage_date);
  perform public.link_child_to_couple(v_couple_id, p_child_id, 'biological');
  return v_couple_id;
end;
$$;

revoke all on function public.add_person(uuid, text, text, gender_bucket, date, date, text, uuid, text, text) from public, anon;
revoke all on function public.create_couple(uuid, uuid, uuid, couple_type, date, date, couple_status) from public, anon;
revoke all on function public.link_child_to_couple(uuid, uuid, parent_child_type) from public, anon;
revoke all on function public.add_child_to_couple(uuid, text, text, gender_bucket, date, text, parent_child_type) from public, anon;
revoke all on function public.add_parent_couple(uuid, uuid, uuid, uuid, date) from public, anon;

grant execute on function public.add_person(uuid, text, text, gender_bucket, date, date, text, uuid, text, text) to authenticated;
grant execute on function public.create_couple(uuid, uuid, uuid, couple_type, date, date, couple_status) to authenticated;
grant execute on function public.link_child_to_couple(uuid, uuid, parent_child_type) to authenticated;
grant execute on function public.add_child_to_couple(uuid, text, text, gender_bucket, date, text, parent_child_type) to authenticated;
grant execute on function public.add_parent_couple(uuid, uuid, uuid, uuid, date) to authenticated;

-- ======================================================================
-- 20260901000500_memories_media.sql
-- ======================================================================

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

-- ======================================================================
-- 20260901000600_events_and_timeline.sql
-- ======================================================================

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

-- ======================================================================
-- 20260901000700_interviews_appearance_ai.sql
-- ======================================================================

set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0007 · Interviews, voice preservation, appearance, AI provenance
-- ----------------------------------------------------------------------------
-- Voice preservation rule: the ORIGINAL audio row in `media` is permanent and
-- immutable (enforced in 0005). A transcript is an interpretation layered on
-- top; it can be corrected by a human and the correction is tracked. Deleting a
-- transcript never deletes the recording.
--
-- AI provenance rule: every AI output is stored in ai_outputs with its provider,
-- model, and an is_mock flag. Nothing in the UI may present an AI output as a
-- historical fact, and a mock (development) response is always visibly a mock.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- interview_question_sets — the questions ROOTS asks. Application content, not
-- family data: shipped with the product, extendable per family.
-- ---------------------------------------------------------------------------
create table interview_question_sets (
  id          uuid primary key default gen_random_uuid(),
  -- null family_id = built-in set available to everyone.
  family_id   uuid references families(id) on delete cascade,
  key         text not null,
  title       text not null,
  description text,
  locale      text not null default 'mn',
  audience    text not null default 'anyone'
              check (audience in ('anyone','grandparent','parent','elder','child')),
  is_builtin  boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- A family may override a built-in set under the same key; both can coexist.
create unique index interview_question_sets_key_idx on interview_question_sets (
  coalesce(family_id, '00000000-0000-0000-0000-000000000000'::uuid), key, locale
);

create table interview_question_templates (
  id          uuid primary key default gen_random_uuid(),
  set_id      uuid not null references interview_question_sets(id) on delete cascade,
  order_index smallint not null,
  question_key text not null,
  question_text text not null,
  hint        text,
  -- What this answer is expected to enrich, so extraction knows where to look.
  expects     text not null default 'story'
              check (expects in ('story','date','place','person','appearance','advice','event')),
  unique (set_id, order_index)
);

-- ---------------------------------------------------------------------------
-- interviews
-- ---------------------------------------------------------------------------
create table interviews (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  -- Who is being interviewed.
  subject_person_id uuid not null references people(id) on delete cascade,
  -- Who is holding the phone. Often a grandchild.
  interviewer_id uuid references auth.users(id) on delete set null,
  interviewer_name text,
  set_id         uuid references interview_question_sets(id) on delete set null,
  title          text,
  status         interview_status not null default 'draft',
  language       text not null default 'mn',
  -- AI summary of the whole session. Structured, never inventive.
  ai_summary     text,
  ai_output_id   uuid,                      -- FK added below
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index interviews_family_idx on interviews (family_id, updated_at desc) where deleted_at is null;
create index interviews_subject_idx on interviews (subject_person_id) where deleted_at is null;
-- Powers "continue your interview" on the home screen.
create index interviews_resumable_idx on interviews (family_id, updated_at desc)
  where status in ('in_progress','paused') and deleted_at is null;

create trigger interviews_touch before update on interviews
  for each row execute function roots.touch_updated_at();

alter table audio_recordings
  add constraint audio_recordings_interview_fk
  foreign key (interview_id) references interviews(id) on delete set null;

-- ---------------------------------------------------------------------------
-- interview_questions — one row per question asked in a session
-- ---------------------------------------------------------------------------
create table interview_questions (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  interview_id  uuid not null references interviews(id) on delete cascade,
  order_index   smallint not null,
  question_key  text,
  question_text text not null,
  -- The original recording of the answer. This is the artefact that matters.
  audio_media_id uuid references media(id) on delete set null,
  skipped       boolean not null default false,
  answered_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (interview_id, order_index)
);

create index interview_questions_interview_idx on interview_questions (interview_id, order_index);

-- ---------------------------------------------------------------------------
-- interview_transcripts
-- ---------------------------------------------------------------------------
create table interview_transcripts (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  interview_id  uuid not null references interviews(id) on delete cascade,
  question_id   uuid references interview_questions(id) on delete cascade,
  audio_media_id uuid references media(id) on delete set null,

  transcript_text text not null,
  language      text not null default 'mn',
  -- Word/segment timings, if the provider returned them.
  segments      jsonb,
  confidence    numeric(4,3) check (confidence is null or confidence between 0 and 1),

  provider      text not null default 'mock',
  model         text,
  is_mock       boolean not null default true,

  -- A relative correcting a mis-heard name is the single most common edit.
  -- We keep the machine version so nothing is silently lost.
  original_text text,
  is_edited     boolean not null default false,
  edited_by     uuid references auth.users(id) on delete set null,
  edited_at     timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index transcripts_interview_idx on interview_transcripts (interview_id);
create index transcripts_question_idx on interview_transcripts (question_id);
create index transcripts_text_idx on interview_transcripts using gin (transcript_text gin_trgm_ops);

create trigger transcripts_touch before update on interview_transcripts
  for each row execute function roots.touch_updated_at();

-- Preserve the machine transcript the first time a human edits it.
create or replace function roots.preserve_original_transcript()
returns trigger
language plpgsql
as $$
begin
  if new.transcript_text is distinct from old.transcript_text then
    if old.original_text is null then
      new.original_text := old.transcript_text;
    end if;
    new.is_edited := true;
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger transcripts_preserve_original before update on interview_transcripts
  for each row execute function roots.preserve_original_transcript();

-- ---------------------------------------------------------------------------
-- ai_outputs — provenance for every single AI call
-- ---------------------------------------------------------------------------
create table ai_outputs (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  task          ai_task not null,
  provider      text not null,
  model         text,
  is_mock       boolean not null default true,

  -- What the AI was given, and what it was pointed at.
  subject_type  text,
  subject_id    uuid,
  input_summary text,

  output_text   text,
  output_json   jsonb,

  -- Everything the model asserted must trace back to rows the family entered.
  -- We store those ids so the UI can show "based on: 3 memories, 2 interviews".
  grounded_on   jsonb not null default '[]'::jsonb,

  token_usage   jsonb,
  latency_ms    integer,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index ai_outputs_family_idx on ai_outputs (family_id, created_at desc);
create index ai_outputs_subject_idx on ai_outputs (subject_type, subject_id);

alter table interviews
  add constraint interviews_ai_output_fk
  foreign key (ai_output_id) references ai_outputs(id) on delete set null;

-- ---------------------------------------------------------------------------
-- appearance_descriptions
-- ----------------------------------------------------------------------------
-- For ancestors with no surviving photograph, the family's memory of their face
-- IS the record. Three kinds of information live here and are NEVER merged:
--   photograph          — verified, derived from a real photo
--   family_description  — a relative's recollection, attributed to them
--   ai_summary          — AI reorganisation of the above; never a new fact
-- The `is_ai_generated` flag drives a visually distinct treatment in the UI.
-- ---------------------------------------------------------------------------
create table appearance_descriptions (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  person_id      uuid not null references people(id) on delete cascade,
  source_kind    appearance_source not null,

  -- Prose, as spoken: "Өндөр нуруутай, өргөн царайтай, зузаан хөмсөгтэй."
  description    text not null check (length(btrim(description)) > 0),
  -- Optional structured facets (height, face_shape, hair, eyes, build, marks...).
  -- Free-form JSON because appearance vocabulary varies by language and family.
  attributes     jsonb not null default '{}'::jsonb,

  -- Written specifically to be read aloud to a visually impaired relative.
  narration_text text,

  based_on_media_id uuid references media(id) on delete set null,
  ai_output_id   uuid references ai_outputs(id) on delete set null,
  is_ai_generated boolean not null default false,

  contributed_by uuid references auth.users(id) on delete set null,
  contributor_name text not null,
  source_id      uuid,          -- FK added in 0008
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint appearance_ai_flag_consistent check (
    (source_kind = 'ai_summary') = is_ai_generated
  ),
  constraint appearance_photo_has_media check (
    source_kind <> 'photograph' or based_on_media_id is not null
  )
);

create index appearance_person_idx on appearance_descriptions (person_id, source_kind);

create trigger appearance_touch before update on appearance_descriptions
  for each row execute function roots.touch_updated_at();

-- ======================================================================
-- 20260901000800_sources_and_claims.sql
-- ======================================================================

set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0008 · Sources, fact claims and conflict preservation
-- ----------------------------------------------------------------------------
-- Family history is contested. Two relatives will remember two different years
-- for the same wedding, and BOTH memories are data. ROOTS therefore never
-- silently picks a winner: conflicting claims about the same field are grouped,
-- each keeps its own source and contributor, and the UI shows the disagreement.
-- ============================================================================

create table sources (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  source_type    source_type not null default 'user_entry',
  title          text not null check (length(btrim(title)) between 1 and 200),
  description    text,
  -- Where the information physically lives, if anywhere.
  media_id       uuid references media(id) on delete set null,
  interview_id   uuid references interviews(id) on delete set null,
  document_media_id uuid references media(id) on delete set null,
  url            text,
  -- Who told us. For source_type='relative' this is the person who remembers.
  informant_person_id uuid references people(id) on delete set null,
  reliability    confidence_level not null default 'probable',
  recorded_at    timestamptz,
  created_by     uuid references auth.users(id) on delete set null,
  created_by_name text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index sources_family_idx on sources (family_id, created_at desc);
create index sources_interview_idx on sources (interview_id);

create trigger sources_touch before update on sources
  for each row execute function roots.touch_updated_at();

-- ---------------------------------------------------------------------------
-- fact_claims — an assertion about a field of a subject, with its source.
-- ---------------------------------------------------------------------------
create table fact_claims (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,

  -- Polymorphic subject. Constrained to the tables that carry historical facts.
  subject_type   text not null check (subject_type in ('person','couple','life_event','memory','location')),
  subject_id     uuid not null,
  -- e.g. 'birth_date', 'birth_place', 'occupation', 'marriage_date'
  field_key      text not null check (length(btrim(field_key)) between 1 and 64),

  value_text     text,
  value_date     date,
  value_number   numeric,
  value_uuid     uuid,

  source_id      uuid references sources(id) on delete set null,
  claimed_by     uuid references auth.users(id) on delete set null,
  claimed_by_name text not null,
  confidence     confidence_level not null default 'probable',
  status         claim_status not null default 'active',

  -- Claims about the same (subject, field) share a conflict group. When a group
  -- holds more than one ACTIVE claim with different values, the field is
  -- disputed and the UI must show every version.
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint fact_claims_has_value check (
    value_text is not null or value_date is not null
    or value_number is not null or value_uuid is not null
  )
);

create index fact_claims_subject_idx on fact_claims (subject_type, subject_id, field_key);
create index fact_claims_family_idx on fact_claims (family_id, created_at desc);

create trigger fact_claims_touch before update on fact_claims
  for each row execute function roots.touch_updated_at();

-- Any (subject, field) with more than one distinct active value is in conflict.
create view fact_conflicts as
  select family_id, subject_type, subject_id, field_key,
         count(*) as claim_count,
         count(distinct coalesce(value_text, value_date::text, value_number::text, value_uuid::text))
           as distinct_values
  from fact_claims
  -- 'disputed' is what record_fact_claim sets once a disagreement appears, so a
  -- conflict must stay visible in both states.
  where status in ('active','disputed')
  group by family_id, subject_type, subject_id, field_key
  having count(distinct coalesce(value_text, value_date::text, value_number::text, value_uuid::text)) > 1;

-- ---------------------------------------------------------------------------
-- Close the source_id loops left open in earlier migrations.
-- ---------------------------------------------------------------------------
alter table person_locations
  add constraint person_locations_source_fk foreign key (source_id) references sources(id) on delete set null;
alter table couples
  add constraint couples_source_fk foreign key (source_id) references sources(id) on delete set null;
alter table parent_child_relationships
  add constraint pcr_source_fk foreign key (source_id) references sources(id) on delete set null;
alter table life_events
  add constraint life_events_source_fk foreign key (source_id) references sources(id) on delete set null;
alter table timeline_events
  add constraint timeline_events_source_fk foreign key (source_id) references sources(id) on delete set null;
alter table appearance_descriptions
  add constraint appearance_source_fk foreign key (source_id) references sources(id) on delete set null;

-- ---------------------------------------------------------------------------
-- record_claim — helper that writes a claim and flags the conflict in one step.
-- ---------------------------------------------------------------------------
create or replace function public.record_fact_claim(
  p_family_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_field_key text,
  p_value_text text default null,
  p_value_date date default null,
  p_source_id uuid default null,
  p_confidence confidence_level default 'probable'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_claim_id uuid;
  v_name text;
  v_distinct integer;
begin
  if not roots.can_contribute(p_family_id) then
    raise exception 'insufficient permission' using errcode = '42501';
  end if;

  select coalesce(display_name, 'Гэр бүлийн гишүүн') into v_name
  from public.profiles where id = auth.uid();

  insert into public.fact_claims (
    family_id, subject_type, subject_id, field_key, value_text, value_date,
    source_id, claimed_by, claimed_by_name, confidence
  )
  values (
    p_family_id, p_subject_type, p_subject_id, p_field_key, p_value_text, p_value_date,
    p_source_id, auth.uid(), coalesce(v_name, 'Гэр бүлийн гишүүн'), p_confidence
  )
  returning id into v_claim_id;

  -- If this disagrees with an existing claim, mark the whole group disputed
  -- rather than choosing a winner.
  select count(distinct coalesce(value_text, value_date::text)) into v_distinct
  from public.fact_claims
  where subject_type = p_subject_type and subject_id = p_subject_id
    and field_key = p_field_key and status in ('active','disputed');

  if v_distinct > 1 then
    update public.fact_claims
    set status = 'disputed'
    where subject_type = p_subject_type and subject_id = p_subject_id
      and field_key = p_field_key and status = 'active';

    perform roots.log_audit(p_family_id, 'fact.conflict_detected', p_subject_type, p_subject_id,
      jsonb_build_object('field', p_field_key, 'distinct_values', v_distinct));
  end if;

  return v_claim_id;
end;
$$;

revoke all on function public.record_fact_claim(uuid, text, uuid, text, text, date, uuid, confidence_level) from public, anon;
grant execute on function public.record_fact_claim(uuid, text, uuid, text, text, date, uuid, confidence_level) to authenticated;

-- ======================================================================
-- 20260901000900_rls_policies.sql
-- ======================================================================

set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0009 · Row Level Security
-- ----------------------------------------------------------------------------
-- Threat model: a logged-in user of family A tries to read or write family B's
-- rows by guessing a uuid. Every family-owned table below denies that by
-- construction — the policy predicate is roots.is_member(family_id), which is
-- evaluated against the JWT, not against anything the client can send.
--
-- Role ladder (roots.role_rank): owner 5 > admin 4 > editor 3 > contributor 2 > viewer 1
--   viewer      — read
--   contributor — read + create memories/media/interviews; edit only their OWN
--   editor      — the above + people, couples, relationships, events
--   admin       — the above + members, invitations, deletes
--   owner       — the above + delete the family itself
-- ============================================================================

alter table profiles                     enable row level security;
alter table families                     enable row level security;
alter table family_members               enable row level security;
alter table permissions                  enable row level security;
alter table invitations                  enable row level security;
alter table audit_logs                   enable row level security;
alter table locations                    enable row level security;
alter table people                       enable row level security;
alter table person_locations             enable row level security;
alter table couples                      enable row level security;
alter table parent_child_relationships   enable row level security;
alter table memories                     enable row level security;
alter table memory_people                enable row level security;
alter table media                        enable row level security;
alter table photos                       enable row level security;
alter table videos                       enable row level security;
alter table audio_recordings             enable row level security;
alter table documents                    enable row level security;
alter table photo_people_tags            enable row level security;
alter table life_events                  enable row level security;
alter table timeline_events              enable row level security;
alter table interview_question_sets      enable row level security;
alter table interview_question_templates enable row level security;
alter table interviews                   enable row level security;
alter table interview_questions          enable row level security;
alter table interview_transcripts        enable row level security;
alter table ai_outputs                   enable row level security;
alter table appearance_descriptions      enable row level security;
alter table sources                      enable row level security;
alter table fact_claims                  enable row level security;

-- Views must run with the CALLER's privileges, otherwise they would bypass the
-- policies of the tables underneath them. This one line is load-bearing.
alter view partner_relationships set (security_invoker = on);
alter view person_memory_links   set (security_invoker = on);
alter view person_photos         set (security_invoker = on);
alter view person_timeline       set (security_invoker = on);
alter view fact_conflicts        set (security_invoker = on);

-- Anonymous users get nothing anywhere.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_self on profiles
  for select to authenticated
  using (
    id = auth.uid()
    -- You can see the profile of anyone who shares a family with you, so that
    -- "contributed by" has a name and a face.
    or exists (
      select 1 from family_members mine
      join family_members theirs on theirs.family_id = mine.family_id
      where mine.user_id = auth.uid() and mine.status = 'active'
        and theirs.user_id = profiles.id and theirs.status = 'active'
    )
  );

create policy profiles_update_self on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_insert_self on profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_delete_self on profiles
  for delete to authenticated using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------
create policy families_select on families
  for select to authenticated using (roots.is_member(id) and deleted_at is null);

-- Families are created through public.create_family() so that ownership is
-- established in the same transaction; direct inserts are not allowed.
create policy families_update on families
  for update to authenticated using (roots.can_admin(id)) with check (roots.can_admin(id));

create policy families_delete on families
  for delete to authenticated using (roots.role_in(id) = 'owner');

-- ---------------------------------------------------------------------------
-- family_members
-- ---------------------------------------------------------------------------
create policy family_members_select on family_members
  for select to authenticated using (user_id = auth.uid() or roots.is_member(family_id));

create policy family_members_insert on family_members
  for insert to authenticated with check (roots.can_admin(family_id));

create policy family_members_update on family_members
  for update to authenticated
  using (roots.can_admin(family_id) or user_id = auth.uid())
  with check (
    -- Admins may change roles; a member may only edit their own row, and may
    -- never promote themselves.
    roots.can_admin(family_id)
    or (user_id = auth.uid() and role = roots.role_in(family_id))
  );

create policy family_members_delete on family_members
  for delete to authenticated
  using (
    -- Admins can remove members; anyone can remove themselves. The owner cannot
    -- be removed while they are still the owner.
    (roots.can_admin(family_id) and role <> 'owner')
    or (user_id = auth.uid() and role <> 'owner')
  );

-- ---------------------------------------------------------------------------
-- permissions
-- ---------------------------------------------------------------------------
create policy permissions_select on permissions
  for select to authenticated using (roots.is_member(family_id));
create policy permissions_write on permissions
  for all to authenticated
  using (roots.can_admin(family_id)) with check (roots.can_admin(family_id));

-- ---------------------------------------------------------------------------
-- invitations — the invitee reads theirs through a SECURITY DEFINER RPC, never
-- through a policy, so an unaccepted token can never be enumerated here.
-- ---------------------------------------------------------------------------
create policy invitations_select on invitations
  for select to authenticated using (roots.can_admin(family_id));
create policy invitations_insert on invitations
  for insert to authenticated with check (roots.can_admin(family_id) and invited_by = auth.uid());
create policy invitations_update on invitations
  for update to authenticated using (roots.can_admin(family_id)) with check (roots.can_admin(family_id));
create policy invitations_delete on invitations
  for delete to authenticated using (roots.can_admin(family_id));

-- ---------------------------------------------------------------------------
-- audit_logs — readable by admins, append-only for everyone. No UPDATE or
-- DELETE policy exists, which makes the log tamper-evident by omission.
-- ---------------------------------------------------------------------------
create policy audit_logs_select on audit_logs
  for select to authenticated using (roots.can_admin(family_id));
create policy audit_logs_insert on audit_logs
  for insert to authenticated with check (roots.is_member(family_id) and actor_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Generic family-scoped content
-- ----------------------------------------------------------------------------
-- The pattern below repeats deliberately rather than hiding behind a DO loop:
-- security policies should be greppable and readable one table at a time.
-- ---------------------------------------------------------------------------

-- locations
create policy locations_select on locations for select to authenticated
  using (roots.is_member(family_id));
create policy locations_insert on locations for insert to authenticated
  with check (roots.can_contribute(family_id));
create policy locations_update on locations for update to authenticated
  using (roots.can_edit(family_id)) with check (roots.can_edit(family_id));
create policy locations_delete on locations for delete to authenticated
  using (roots.can_admin(family_id));

-- people
create policy people_select on people for select to authenticated
  using (roots.is_member(family_id) and deleted_at is null);
create policy people_insert on people for insert to authenticated
  with check (roots.can_edit(family_id));
create policy people_update on people for update to authenticated
  using (roots.can_edit(family_id)) with check (roots.can_edit(family_id));
-- Deleting a person is a soft delete performed by an admin; hard delete is
-- reserved for the family owner erasing the whole family.
create policy people_delete on people for delete to authenticated
  using (roots.can_admin(family_id));

-- person_locations
create policy person_locations_select on person_locations for select to authenticated
  using (roots.is_member(family_id));
create policy person_locations_write on person_locations for all to authenticated
  using (roots.can_edit(family_id)) with check (roots.can_edit(family_id));

-- couples
create policy couples_select on couples for select to authenticated
  using (roots.is_member(family_id) and deleted_at is null);
create policy couples_insert on couples for insert to authenticated
  with check (roots.can_edit(family_id));
create policy couples_update on couples for update to authenticated
  using (roots.can_edit(family_id)) with check (roots.can_edit(family_id));
create policy couples_delete on couples for delete to authenticated
  using (roots.can_admin(family_id));

-- parent_child_relationships
create policy pcr_select on parent_child_relationships for select to authenticated
  using (roots.is_member(family_id));
create policy pcr_insert on parent_child_relationships for insert to authenticated
  with check (roots.can_edit(family_id));
create policy pcr_update on parent_child_relationships for update to authenticated
  using (roots.can_edit(family_id)) with check (roots.can_edit(family_id));
create policy pcr_delete on parent_child_relationships for delete to authenticated
  using (roots.can_edit(family_id));

-- memories: contributors keep control of what they contributed
create policy memories_select on memories for select to authenticated
  using (
    roots.is_member(family_id) and deleted_at is null
    and (not is_private or contributor_id = auth.uid() or roots.can_admin(family_id))
  );
create policy memories_insert on memories for insert to authenticated
  with check (roots.can_contribute(family_id) and contributor_id = auth.uid());
create policy memories_update on memories for update to authenticated
  using (roots.can_edit(family_id) or contributor_id = auth.uid())
  with check (roots.can_edit(family_id) or contributor_id = auth.uid());
create policy memories_delete on memories for delete to authenticated
  using (roots.can_admin(family_id) or contributor_id = auth.uid());

-- memory_people
create policy memory_people_select on memory_people for select to authenticated
  using (roots.is_member(family_id));
create policy memory_people_write on memory_people for all to authenticated
  using (roots.can_contribute(family_id)) with check (roots.can_contribute(family_id));

-- media
create policy media_select on media for select to authenticated
  using (roots.is_member(family_id) and deleted_at is null);
create policy media_insert on media for insert to authenticated
  with check (roots.can_contribute(family_id) and uploaded_by = auth.uid());
create policy media_update on media for update to authenticated
  using (roots.can_edit(family_id) or uploaded_by = auth.uid())
  with check (roots.can_edit(family_id) or uploaded_by = auth.uid());
-- No DELETE policy on media at all: originals are permanent, and derived files
-- are retired with deleted_at. This is the archive's core promise, in one place.

-- media subtypes follow their parent row
create policy photos_select on photos for select to authenticated using (roots.is_member(family_id));
create policy photos_write  on photos for all    to authenticated
  using (roots.can_contribute(family_id)) with check (roots.can_contribute(family_id));

create policy videos_select on videos for select to authenticated using (roots.is_member(family_id));
create policy videos_write  on videos for all    to authenticated
  using (roots.can_contribute(family_id)) with check (roots.can_contribute(family_id));

create policy audio_select on audio_recordings for select to authenticated using (roots.is_member(family_id));
create policy audio_write  on audio_recordings for all    to authenticated
  using (roots.can_contribute(family_id)) with check (roots.can_contribute(family_id));

create policy documents_select on documents for select to authenticated using (roots.is_member(family_id));
create policy documents_write  on documents for all    to authenticated
  using (roots.can_contribute(family_id)) with check (roots.can_contribute(family_id));

-- photo_people_tags
create policy photo_tags_select on photo_people_tags for select to authenticated
  using (roots.is_member(family_id));
create policy photo_tags_insert on photo_people_tags for insert to authenticated
  with check (roots.can_contribute(family_id));
create policy photo_tags_update on photo_people_tags for update to authenticated
  using (roots.can_contribute(family_id)) with check (roots.can_contribute(family_id));
create policy photo_tags_delete on photo_people_tags for delete to authenticated
  using (roots.can_edit(family_id) or created_by = auth.uid());

-- life_events / timeline_events
create policy life_events_select on life_events for select to authenticated
  using (roots.is_member(family_id) and deleted_at is null);
create policy life_events_insert on life_events for insert to authenticated
  with check (roots.can_contribute(family_id));
create policy life_events_update on life_events for update to authenticated
  using (roots.can_edit(family_id) or created_by = auth.uid())
  with check (roots.can_edit(family_id) or created_by = auth.uid());
create policy life_events_delete on life_events for delete to authenticated
  using (roots.can_edit(family_id));

create policy timeline_events_select on timeline_events for select to authenticated
  using (roots.is_member(family_id) and deleted_at is null);
create policy timeline_events_write on timeline_events for all to authenticated
  using (roots.can_edit(family_id)) with check (roots.can_edit(family_id));

-- interview question sets: built-ins are readable by every authenticated user
create policy question_sets_select on interview_question_sets for select to authenticated
  using (family_id is null or roots.is_member(family_id));
create policy question_sets_write on interview_question_sets for all to authenticated
  using (family_id is not null and roots.can_edit(family_id))
  with check (family_id is not null and roots.can_edit(family_id));

create policy question_templates_select on interview_question_templates for select to authenticated
  using (exists (
    select 1 from interview_question_sets s
    where s.id = set_id and (s.family_id is null or roots.is_member(s.family_id))
  ));
create policy question_templates_write on interview_question_templates for all to authenticated
  using (exists (
    select 1 from interview_question_sets s
    where s.id = set_id and s.family_id is not null and roots.can_edit(s.family_id)
  ))
  with check (exists (
    select 1 from interview_question_sets s
    where s.id = set_id and s.family_id is not null and roots.can_edit(s.family_id)
  ));

-- interviews
create policy interviews_select on interviews for select to authenticated
  using (roots.is_member(family_id) and deleted_at is null);
create policy interviews_insert on interviews for insert to authenticated
  with check (roots.can_contribute(family_id));
create policy interviews_update on interviews for update to authenticated
  using (roots.can_edit(family_id) or interviewer_id = auth.uid())
  with check (roots.can_edit(family_id) or interviewer_id = auth.uid());
create policy interviews_delete on interviews for delete to authenticated
  using (roots.can_admin(family_id));

create policy interview_questions_select on interview_questions for select to authenticated
  using (roots.is_member(family_id));
create policy interview_questions_write on interview_questions for all to authenticated
  using (roots.can_contribute(family_id)) with check (roots.can_contribute(family_id));

-- Transcripts can be corrected by any contributor (a relative fixing a name),
-- but the machine original is preserved by trigger, not by policy.
create policy transcripts_select on interview_transcripts for select to authenticated
  using (roots.is_member(family_id));
create policy transcripts_insert on interview_transcripts for insert to authenticated
  with check (roots.can_contribute(family_id));
create policy transcripts_update on interview_transcripts for update to authenticated
  using (roots.can_contribute(family_id)) with check (roots.can_contribute(family_id));
create policy transcripts_delete on interview_transcripts for delete to authenticated
  using (roots.can_admin(family_id));

-- ai_outputs are written server-side only; clients may read their provenance.
create policy ai_outputs_select on ai_outputs for select to authenticated
  using (roots.is_member(family_id));

-- appearance_descriptions
create policy appearance_select on appearance_descriptions for select to authenticated
  using (roots.is_member(family_id));
create policy appearance_insert on appearance_descriptions for insert to authenticated
  with check (roots.can_contribute(family_id));
create policy appearance_update on appearance_descriptions for update to authenticated
  using (roots.can_edit(family_id) or contributed_by = auth.uid())
  with check (roots.can_edit(family_id) or contributed_by = auth.uid());
create policy appearance_delete on appearance_descriptions for delete to authenticated
  using (roots.can_edit(family_id) or contributed_by = auth.uid());

-- sources & fact_claims
create policy sources_select on sources for select to authenticated
  using (roots.is_member(family_id));
create policy sources_insert on sources for insert to authenticated
  with check (roots.can_contribute(family_id));
create policy sources_update on sources for update to authenticated
  using (roots.can_edit(family_id) or created_by = auth.uid())
  with check (roots.can_edit(family_id) or created_by = auth.uid());
create policy sources_delete on sources for delete to authenticated
  using (roots.can_admin(family_id));

create policy fact_claims_select on fact_claims for select to authenticated
  using (roots.is_member(family_id));
create policy fact_claims_insert on fact_claims for insert to authenticated
  with check (roots.can_contribute(family_id) and claimed_by = auth.uid());
-- A claim is a historical record of what someone said. It is never edited by
-- anyone else; it can only be retracted by its author or superseded by a new one.
create policy fact_claims_update on fact_claims for update to authenticated
  using (claimed_by = auth.uid() or roots.can_admin(family_id))
  with check (claimed_by = auth.uid() or roots.can_admin(family_id));

-- ======================================================================
-- 20260901001000_storage_policies.sql
-- ======================================================================

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
drop policy if exists "family media read" on storage.objects;
create policy "family media read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'family-media'
    and roots.family_from_object_path(name) is not null
    and roots.is_member(roots.family_from_object_path(name))
  );

-- Writes: contributor and above, and only into their own family's prefix.
drop policy if exists "family media insert" on storage.objects;
create policy "family media insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'family-media'
    and roots.family_from_object_path(name) is not null
    and roots.can_contribute(roots.family_from_object_path(name))
  );

-- Updates are restricted to the derived/ prefix. There is no path by which a
-- client can overwrite a file stored under original/.
drop policy if exists "family media update derived only" on storage.objects;
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
drop policy if exists "family media delete derived only" on storage.objects;
create policy "family media delete derived only" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'family-media'
    and roots.family_from_object_path(name) is not null
    and roots.can_admin(roots.family_from_object_path(name))
    and name like '%/derived/%'
  );

-- ======================================================================
-- 20260901001100_rpc_invitations_search_export.sql
-- ======================================================================

set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0011 · Invitations, graph loading, search, export, deletion
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Invitations
-- ----------------------------------------------------------------------------
-- The plaintext token is returned exactly once, to the admin who created it.
-- Only its sha256 is stored, so a database leak does not hand over live invites.
-- ---------------------------------------------------------------------------
create or replace function public.create_invitation(
  p_family_id uuid,
  p_role family_role default 'contributor',
  p_email text default null,
  p_person_id uuid default null,
  p_message text default null,
  p_expires_in_days integer default 14
)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text;
  v_id uuid;
begin
  if not roots.can_admin(p_family_id) then
    raise exception 'only admins can invite' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'ownership is transferred, not invited' using errcode = '22023';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.invitations (family_id, email, role, token_hash, person_id, message,
                                  invited_by, expires_at)
  values (
    p_family_id, nullif(lower(btrim(p_email)), ''), p_role,
    encode(digest(v_token, 'sha256'), 'hex'),
    p_person_id, nullif(btrim(p_message), ''), auth.uid(),
    now() + make_interval(days => greatest(1, least(coalesce(p_expires_in_days, 14), 90)))
  )
  returning id into v_id;

  perform roots.log_audit(p_family_id, 'invitation.created', 'invitation', v_id,
                          jsonb_build_object('role', p_role, 'email', p_email));

  return query select v_id, v_token;
end;
$$;

-- Look at an invitation before accepting it, without joining anything.
create or replace function public.preview_invitation(p_token text)
returns table (family_id uuid, family_name text, role family_role, invited_by_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
begin
  return query
  select f.id, f.name, i.role, coalesce(p.display_name, ''), i.expires_at
  from public.invitations i
  join public.families f on f.id = i.family_id
  left join public.profiles p on p.id = i.invited_by
  where i.token_hash = v_hash
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and f.deleted_at is null;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_inv public.invitations%rowtype;
  v_hash text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_inv
  from public.invitations
  where token_hash = v_hash
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'this invitation is not valid any more' using errcode = 'P0002';
  end if;

  insert into public.family_members (family_id, user_id, role, status, person_id, invited_by)
  values (v_inv.family_id, v_user, v_inv.role, 'active', v_inv.person_id, v_inv.invited_by)
  on conflict (family_id, user_id) do update
    -- Re-accepting never downgrades an existing, higher role.
    set role = case
                 when roots.role_rank(family_members.role) >= roots.role_rank(excluded.role)
                 then family_members.role else excluded.role end,
        status = 'active',
        person_id = coalesce(family_members.person_id, excluded.person_id);

  update public.invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  perform roots.log_audit(v_inv.family_id, 'invitation.accepted', 'invitation', v_inv.id,
                          jsonb_build_object('role', v_inv.role));

  return v_inv.family_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_family_graph — everything the tree renderer needs, in ONE round trip.
-- The tree is interactive; it cannot afford N+1 queries while panning.
-- ---------------------------------------------------------------------------
create or replace function public.get_family_graph(p_family_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not roots.is_member(p_family_id) then
    raise exception 'not a member of this family' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'family_id', p_family_id,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'nickname', p.nickname,
        'gender', p.gender,
        'birth_date', p.birth_date,
        'death_date', p.death_date,
        'life_status', p.life_status,
        'generation', p.generation,
        'is_archived', p.is_archived,
        'occupation', p.occupation,
        'birth_place_id', p.birth_place_id,
        'profile_photo_media_id', p.profile_photo_media_id
      ) order by p.generation nulls last, p.birth_date nulls last, p.first_name)
      from public.people p
      where p.family_id = p_family_id and p.deleted_at is null
    ), '[]'::jsonb),
    'couples', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'person_a_id', c.person_a_id,
        'person_b_id', c.person_b_id,
        'relationship_type', c.relationship_type,
        'status', c.status,
        'marriage_date', c.marriage_date,
        'relationship_start', c.relationship_start,
        'relationship_end', c.relationship_end
      ) order by c.marriage_date nulls last)
      from public.couples c
      where c.family_id = p_family_id and c.deleted_at is null
    ), '[]'::jsonb),
    'parent_child', coalesce((
      select jsonb_agg(jsonb_build_object(
        'parent_id', r.parent_id,
        'child_id', r.child_id,
        'couple_id', r.couple_id,
        'relationship_type', r.relationship_type
      ))
      from public.parent_child_relationships r
      where r.family_id = p_family_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- search_family — one query across people, memories, transcripts and documents.
-- Plain database search; AI is not involved and is not needed here.
-- ---------------------------------------------------------------------------
create or replace function public.search_family(p_family_id uuid, p_query text, p_limit integer default 40)
returns table (
  result_type text,
  result_id uuid,
  title text,
  subtitle text,
  snippet text,
  event_date date,
  rank real
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
begin
  if not roots.is_member(p_family_id) then
    raise exception 'not a member of this family' using errcode = '42501';
  end if;
  if length(v_q) = 0 then
    return;
  end if;

  return query
  select * from (
    select 'person'::text, p.id,
           btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')),
           coalesce(p.occupation, ''),
           coalesce(p.biography, ''),
           p.birth_date,
           similarity(
             unaccent(lower(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'') || ' ' || coalesce(p.nickname,''))),
             unaccent(lower(v_q))
           ) + 0.35::real as rank
    from public.people p
    where p.family_id = p_family_id and p.deleted_at is null
      and unaccent(lower(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'') || ' ' || coalesce(p.nickname,'')))
          ilike '%' || unaccent(lower(v_q)) || '%'

    union all
    select 'memory', m.id, m.title, coalesce(m.contributor_name, ''),
           left(coalesce(m.body, m.description, ''), 240), m.memory_date,
           similarity(unaccent(lower(m.title)), unaccent(lower(v_q))) + 0.15::real
    from public.memories m
    where m.family_id = p_family_id and m.deleted_at is null
      and (not m.is_private or m.contributor_id = auth.uid() or roots.can_admin(p_family_id))
      and unaccent(lower(coalesce(m.title,'') || ' ' || coalesce(m.description,'') || ' ' || coalesce(m.body,'')))
          ilike '%' || unaccent(lower(v_q)) || '%'

    union all
    select 'transcript', t.id,
           coalesce(i.title, 'Ярилцлага'),
           coalesce(pe.first_name, ''),
           left(t.transcript_text, 240), null::date,
           0.1::real
    from public.interview_transcripts t
    join public.interviews i on i.id = t.interview_id and i.deleted_at is null
    left join public.people pe on pe.id = i.subject_person_id
    where t.family_id = p_family_id
      and unaccent(lower(t.transcript_text)) ilike '%' || unaccent(lower(v_q)) || '%'

    union all
    select 'document', d.media_id, coalesce(md.caption, md.original_filename, 'Баримт'),
           d.doc_type::text, left(coalesce(d.ocr_text,''), 240), null::date, 0.05::real
    from public.documents d
    join public.media md on md.id = d.media_id and md.deleted_at is null
    where d.family_id = p_family_id
      and d.ocr_text is not null
      and unaccent(lower(d.ocr_text)) ilike '%' || unaccent(lower(v_q)) || '%'
  ) results(result_type, result_id, title, subtitle, snippet, event_date, rank)
  -- Qualified deliberately: `rank` is also this function's OUT parameter, and an
  -- unqualified reference is ambiguous to plpgsql (SQLSTATE 42702).
  order by results.rank desc nulls last
  limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

-- ---------------------------------------------------------------------------
-- export_family — the family owns its data and can take it out whole.
-- ---------------------------------------------------------------------------
create or replace function public.export_family(p_family_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v jsonb;
begin
  if not roots.can_admin(p_family_id) then
    raise exception 'only admins can export a family archive' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'format_version', 1,
    'family', to_jsonb(f) - 'created_by',
    'people', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.people p where p.family_id = p_family_id),
    'couples', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.couples c where c.family_id = p_family_id),
    'parent_child_relationships', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.parent_child_relationships r where r.family_id = p_family_id),
    'locations', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from public.locations l where l.family_id = p_family_id),
    'memories', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.memories m where m.family_id = p_family_id),
    'memory_people', (select coalesce(jsonb_agg(to_jsonb(mp)), '[]'::jsonb) from public.memory_people mp where mp.family_id = p_family_id),
    'media', (select coalesce(jsonb_agg(to_jsonb(md)), '[]'::jsonb) from public.media md where md.family_id = p_family_id),
    'life_events', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from public.life_events e where e.family_id = p_family_id),
    'timeline_events', (select coalesce(jsonb_agg(to_jsonb(te)), '[]'::jsonb) from public.timeline_events te where te.family_id = p_family_id),
    'interviews', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.interviews i where i.family_id = p_family_id),
    'interview_transcripts', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.interview_transcripts t where t.family_id = p_family_id),
    'appearance_descriptions', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.appearance_descriptions a where a.family_id = p_family_id),
    'sources', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.sources s where s.family_id = p_family_id),
    'fact_claims', (select coalesce(jsonb_agg(to_jsonb(fc)), '[]'::jsonb) from public.fact_claims fc where fc.family_id = p_family_id)
  ) into v
  from public.families f
  where f.id = p_family_id;

  perform roots.log_audit(p_family_id, 'family.exported', 'family', p_family_id, '{}'::jsonb);
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deletion
-- ---------------------------------------------------------------------------
create or replace function public.delete_memory(p_memory_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_memory public.memories%rowtype;
begin
  select * into v_memory from public.memories where id = p_memory_id and deleted_at is null;
  if not found then
    raise exception 'memory not found' using errcode = 'P0002';
  end if;
  if not (roots.can_admin(v_memory.family_id) or v_memory.contributor_id = auth.uid()) then
    raise exception 'only the contributor or an admin can remove this memory' using errcode = '42501';
  end if;

  -- Soft delete: the memory leaves the archive's surface but the underlying
  -- original media rows are untouched, so nothing irreplaceable is destroyed.
  update public.memories set deleted_at = now() where id = p_memory_id;
  update public.media set deleted_at = now() where memory_id = p_memory_id and variant <> 'original';

  perform roots.log_audit(v_memory.family_id, 'memory.deleted', 'memory', p_memory_id, '{}'::jsonb);
end;
$$;

create or replace function public.delete_family(p_family_id uuid, p_confirm_name text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name text;
begin
  if roots.role_in(p_family_id) is distinct from 'owner' then
    raise exception 'only the owner can delete a family archive' using errcode = '42501';
  end if;

  select name into v_name from public.families where id = p_family_id;
  if v_name is distinct from btrim(coalesce(p_confirm_name, '')) then
    raise exception 'confirmation name does not match' using errcode = '22023';
  end if;

  perform roots.log_audit(p_family_id, 'family.deleted', 'family', p_family_id,
                          jsonb_build_object('name', v_name));
  delete from public.families where id = p_family_id;
end;
$$;

-- Leaving is not deleting. A member who leaves keeps their contributions in the
-- archive under their name — the family does not lose its own memories.
create or replace function public.leave_family(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if roots.role_in(p_family_id) = 'owner' then
    raise exception 'transfer ownership before leaving' using errcode = '42501';
  end if;
  update public.family_members
  set status = 'left'
  where family_id = p_family_id and user_id = auth.uid();
  perform roots.log_audit(p_family_id, 'member.left', 'family_member', null, '{}'::jsonb);
end;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public.create_invitation(uuid, family_role, text, uuid, text, integer)',
    'public.preview_invitation(text)',
    'public.accept_invitation(text)',
    'public.get_family_graph(uuid)',
    'public.search_family(uuid, text, integer)',
    'public.export_family(uuid)',
    'public.delete_memory(uuid)',
    'public.delete_family(uuid, text)',
    'public.leave_family(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- ======================================================================
-- 20260901001200_builtin_question_sets.sql
-- ======================================================================

set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0012 · Built-in interview question sets
-- ----------------------------------------------------------------------------
-- This is PRODUCT content, not family data: the questions ROOTS asks. It ships
-- in Mongolian first, with an English set alongside so the localisation path is
-- real rather than theoretical. A family can add its own set at any time.
-- ============================================================================

with mn_set as (
  insert into interview_question_sets (family_id, key, title, description, locale, audience, is_builtin)
  values (null, 'life_story', 'Амьдралын түүх',
          'Ах, эгч, аав, ээж, өвөө, эмээгээсээ асуух үндсэн асуултууд.', 'mn', 'elder', true)
  returning id
)
insert into interview_question_templates (set_id, order_index, question_key, question_text, hint, expects)
select mn_set.id, v.order_index, v.question_key, v.question_text, v.hint, v.expects::text
from mn_set, (values
  (1,  'birthplace',      'Та хаана төрсөн бэ?', 'Аймаг, сум, багийн нэрийг дурдаж болно.', 'place'),
  (2,  'birth_time',      'Хэдэн онд төрсөн бэ? Тэр үеийн тухай юу санаж байна вэ?', null, 'date'),
  (3,  'childhood',       'Таны бага нас ямар байсан бэ?', 'Хамгийн тод дурсамжаа ярина уу.', 'story'),
  (4,  'parents',         'Аав ээжийнхээ тухай юу санаж байна вэ?', 'Ямар хүмүүс байсан бэ?', 'story'),
  (5,  'parents_look',    'Аав ээж тань ямар царайлаг байсан бэ?', 'Өндөр намхан, царайны хэлбэр, үс, хөмсөг.', 'appearance'),
  (6,  'grandparents',    'Өвөө эмээгийнхээ тухай юу мэдэх вэ?', null, 'story'),
  (7,  'siblings',        'Ах дүү нар тань хэд байсан бэ?', null, 'person'),
  (8,  'home',            'Таны өссөн гэр ямар байсан бэ?', 'Гэр, байшин, хашаа, малын тухай.', 'story'),
  (9,  'school',          'Сургуулийн жилүүд ямар байсан бэ?', null, 'story'),
  (10, 'first_job',       'Анхны ажил тань юу байсан бэ?', null, 'event'),
  (11, 'meeting_partner', 'Хань тайгаа хэрхэн танилцсан бэ?', 'Хаана, хэдэн онд, хэн танилцуулсан.', 'story'),
  (12, 'wedding',         'Хуримын өдрөө яаж санаж байна вэ?', null, 'event'),
  (13, 'children',        'Хүүхдүүд тань төрөх үед ямар мэдрэмж төрсөн бэ?', null, 'story'),
  (14, 'hardest',         'Амьдралын хамгийн хэцүү үе аль нь байсан бэ?', null, 'story'),
  (15, 'most_important',  'Амьдралын тань хамгийн чухал үйл явдал юу вэ?', null, 'event'),
  (16, 'moves',           'Та ямар ямар газар амьдарч байсан бэ?', 'Он оноор нь дурдаж болно.', 'place'),
  (17, 'tradition',       'Манай гэр бүлд ямар уламжлал байдаг вэ?', null, 'story'),
  (18, 'recipe',          'Хамгийн их санагддаг гэрийн хоол юу вэ?', null, 'story'),
  (19, 'proud',           'Юугаараа хамгийн их бахархдаг вэ?', null, 'story'),
  (20, 'advice',          'Ач зээ нартаа ямар зөвлөгөө өгөх вэ?', 'Энэ хариулт үүрд хадгалагдана.', 'advice')
) as v(order_index, question_key, question_text, hint, expects);

with en_set as (
  insert into interview_question_sets (family_id, key, title, description, locale, audience, is_builtin)
  values (null, 'life_story', 'Life story',
          'The core questions to ask a parent, grandparent or elder relative.', 'en', 'elder', true)
  returning id
)
insert into interview_question_templates (set_id, order_index, question_key, question_text, hint, expects)
select en_set.id, v.order_index, v.question_key, v.question_text, v.hint, v.expects::text
from en_set, (values
  (1,  'birthplace',      'Where were you born?', null, 'place'),
  (2,  'birth_time',      'What year were you born, and what do you remember of that time?', null, 'date'),
  (3,  'childhood',       'What was your childhood like?', null, 'story'),
  (4,  'parents',         'What do you remember about your parents?', null, 'story'),
  (5,  'parents_look',    'What did your parents look like?', 'Height, face, hair, eyebrows.', 'appearance'),
  (6,  'grandparents',    'What do you know about your grandparents?', null, 'story'),
  (7,  'siblings',        'How many brothers and sisters did you have?', null, 'person'),
  (8,  'home',            'What was the home you grew up in like?', null, 'story'),
  (9,  'school',          'What were your school years like?', null, 'story'),
  (10, 'first_job',       'What was your first job?', null, 'event'),
  (11, 'meeting_partner', 'How did you meet your partner?', null, 'story'),
  (12, 'wedding',         'What do you remember about your wedding day?', null, 'event'),
  (13, 'children',        'What was it like when your children were born?', null, 'story'),
  (14, 'hardest',         'What was the hardest period of your life?', null, 'story'),
  (15, 'most_important',  'What was the most important event in your life?', null, 'event'),
  (16, 'moves',           'Which places have you lived in?', null, 'place'),
  (17, 'tradition',       'What traditions does our family keep?', null, 'story'),
  (18, 'recipe',          'Which home-cooked dish do you miss most?', null, 'story'),
  (19, 'proud',           'What are you most proud of?', null, 'story'),
  (20, 'advice',          'What advice would you give your grandchildren?', 'This answer is kept forever.', 'advice')
) as v(order_index, question_key, question_text, hint, expects);

-- ======================================================================
-- Backfill (not a migration)
-- ----------------------------------------------------------------------
-- The on_auth_user_created trigger only fires for future sign-ups. Anyone
-- who registered before this schema was installed has no profile row, so
-- give them one. Idempotent — safe to run again.
-- ======================================================================

insert into public.profiles (id, display_name, locale)
select
  u.id,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(u.email, 'family member'), '@', 1)
  ),
  coalesce(nullif(u.raw_user_meta_data ->> 'locale', ''), 'mn')
from auth.users u
on conflict (id) do nothing;

-- ======================================================================
-- 20260903000100_family_join_codes.sql
-- ======================================================================

set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0013 · Family join codes
-- ----------------------------------------------------------------------------
-- An invitation is a private, one-time link addressed to one person. A JOIN
-- CODE is the other half of the same idea and the one families actually use:
-- the person who starts the tree gets a short code — ROOT-7K3D — and reads it
-- out at a birthday, puts it in the family group chat, writes it on the back of
-- a photograph. Anyone who signs up and types it lands inside that family.
--
-- Because a code is spoken and re-used, it is designed on different terms from
-- an invitation token:
--
--   · SHORT AND UNAMBIGUOUS. Eight characters of Crockford base32 — no I, L, O
--     or U — so nothing is lost between a grandmother reading it aloud and a
--     grandson typing it. That is 40 bits: far past guessing over a network,
--     while still being a thing you can say on the phone.
--   · STORED IN PLAINTEXT, unlike an invitation token, because an admin must be
--     able to look it up again a year later. It is therefore readable only by
--     that family's admins, and redeemable only through the function below,
--     which never returns anything about a code that does not match.
--   · REVOCABLE AND FINITE. It can be switched off, rotated, given an expiry or
--     a maximum number of uses, and every redemption is written to the audit
--     log. A code that leaks is a code you replace in one click, not a breach.
--   · LOWER-PRIVILEGE BY DEFAULT. Joining by code makes a contributor: someone
--     who can add memories and photographs but cannot restructure the tree.
--     Editing the family's shape stays with people an admin promoted by hand.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- family_join_codes — at most one live code per family
-- ---------------------------------------------------------------------------
create table if not exists family_join_codes (
  family_id   uuid primary key references families(id) on delete cascade,
  code        text not null unique check (code ~ '^[0-9A-Z]{4}-[0-9A-Z]{4}$'),
  -- The role a person receives by using it. Never 'owner': ownership is
  -- transferred deliberately, never handed out by a string.
  role        family_role not null default 'contributor'
              check (role in ('viewer', 'contributor', 'editor')),
  is_enabled  boolean not null default true,
  -- Both optional. A family code is normally open-ended; these exist for the
  -- family that wants to open the door for one weekend only.
  expires_at  timestamptz,
  max_uses    integer check (max_uses is null or max_uses > 0),
  use_count   integer not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  rotated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger family_join_codes_touch before update on family_join_codes
  for each row execute function roots.touch_updated_at();

alter table family_join_codes enable row level security;

-- Admins of the family, and nobody else. Redemption does not read this table
-- directly — join_family_with_code() does, as definer, so a person outside the
-- family can never select a row to test a guess against.
drop policy if exists family_join_codes_read on family_join_codes;
create policy family_join_codes_read on family_join_codes
  for select to authenticated
  using (roots.can_admin(family_id));

-- No insert/update/delete policies at all: every write goes through the
-- functions below, which is what keeps `code` unguessable and `use_count`
-- honest.

-- ---------------------------------------------------------------------------
-- Code generation and normalisation
-- ---------------------------------------------------------------------------
-- Crockford base32: the digits and letters that survive being read aloud,
-- minus I, L, O and U. 32 divides 256 exactly, so drawing a byte and taking it
-- modulo 32 is unbiased.
create or replace function roots.new_join_code()
returns text
language plpgsql
volatile
set search_path = public, extensions, pg_temp
as $$
declare
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_raw text;
  v_code text;
begin
  loop
    v_raw := '';
    for i in 1..8 loop
      v_raw := v_raw || substr(v_alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    end loop;
    v_code := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4);
    exit when not exists (select 1 from public.family_join_codes where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- What someone typed, turned into what is stored. Case is ignored, spaces and
-- dashes are ignored, and the letters Crockford leaves out are folded back to
-- the digits they are always mistaken for: O is a zero, I and L are ones. U is
-- dropped rather than mapped — it never appears in a generated code, so a code
-- containing one is wrong, and silently turning it into a V would be inventing
-- a different family's code rather than rejecting a typo.
create or replace function roots.normalize_join_code(p_input text)
returns text
language sql
immutable
as $$
  select case
    when length(cleaned) = 8 then substr(cleaned, 1, 4) || '-' || substr(cleaned, 5, 4)
    else null
  end
  from (
    select regexp_replace(
             translate(upper(coalesce(p_input, '')), 'OILU', '011'),
             '[^0-9A-Z]', '', 'g'
           ) as cleaned
  ) normalised;
$$;

-- ---------------------------------------------------------------------------
-- Every family gets a code the moment it exists
-- ---------------------------------------------------------------------------
create or replace function roots.issue_join_code()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.family_join_codes (family_id, code, created_by)
  values (new.id, roots.new_join_code(), new.created_by)
  on conflict (family_id) do nothing;
  return new;
end;
$$;

drop trigger if exists families_issue_join_code on families;
create trigger families_issue_join_code
  after insert on families
  for each row execute function roots.issue_join_code();

-- Families that existed before this migration.
insert into family_join_codes (family_id, code, created_by)
select f.id, roots.new_join_code(), f.created_by
from families f
where f.deleted_at is null
on conflict (family_id) do nothing;

-- ---------------------------------------------------------------------------
-- Admin surface
-- ---------------------------------------------------------------------------
create or replace function public.get_join_code(p_family_id uuid)
returns table (
  code text, role family_role, is_enabled boolean,
  expires_at timestamptz, max_uses integer, use_count integer, rotated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not roots.can_admin(p_family_id) then
    raise exception 'only admins can see the family code' using errcode = '42501';
  end if;

  -- Lazily issue one, so a family created by some future path that skips the
  -- trigger still answers this question instead of erroring.
  insert into public.family_join_codes (family_id, code, created_by)
  values (p_family_id, roots.new_join_code(), auth.uid())
  on conflict (family_id) do nothing;

  return query
  select c.code, c.role, c.is_enabled, c.expires_at, c.max_uses, c.use_count, c.rotated_at
  from public.family_join_codes c
  where c.family_id = p_family_id;
end;
$$;

-- Replace the code. The old one stops working the moment this returns, which
-- is the entire point: a code written on a whiteboard is retired in one click.
create or replace function public.rotate_join_code(p_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text;
begin
  if not roots.can_admin(p_family_id) then
    raise exception 'only admins can change the family code' using errcode = '42501';
  end if;

  v_code := roots.new_join_code();

  insert into public.family_join_codes (family_id, code, created_by)
  values (p_family_id, v_code, auth.uid())
  on conflict (family_id) do update
    set code = excluded.code, use_count = 0, rotated_at = now();

  perform roots.log_audit(p_family_id, 'join_code.rotated', 'family', p_family_id, '{}'::jsonb);
  return v_code;
end;
$$;

create or replace function public.set_join_code_policy(
  p_family_id uuid,
  p_is_enabled boolean default null,
  p_role family_role default null,
  p_expires_at timestamptz default null,
  p_max_uses integer default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not roots.can_admin(p_family_id) then
    raise exception 'only admins can change the family code' using errcode = '42501';
  end if;
  if p_role is not null and p_role not in ('viewer', 'contributor', 'editor') then
    raise exception 'a join code cannot grant that role' using errcode = '22023';
  end if;

  update public.family_join_codes
  set is_enabled = coalesce(p_is_enabled, is_enabled),
      role       = coalesce(p_role, role),
      -- Passing null leaves these alone; clearing them is done by rotating.
      expires_at = coalesce(p_expires_at, expires_at),
      max_uses   = coalesce(p_max_uses, max_uses)
  where family_id = p_family_id;

  perform roots.log_audit(p_family_id, 'join_code.updated', 'family', p_family_id,
                          jsonb_build_object('enabled', p_is_enabled, 'role', p_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- Redemption
-- ---------------------------------------------------------------------------
-- Look before you leap: which family is this code for? Returns nothing at all
-- for a code that is wrong, switched off, expired or used up — one answer for
-- every kind of failure, so the function cannot be used to learn which codes
-- exist.
create or replace function public.preview_join_code(p_code text)
returns table (family_id uuid, family_name text, role family_role, member_count integer)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := roots.normalize_join_code(p_code);
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_code is null then
    return;
  end if;

  return query
  select f.id, f.name, c.role,
         (select count(*)::integer from public.family_members m
          where m.family_id = f.id and m.status = 'active')
  from public.family_join_codes c
  join public.families f on f.id = c.family_id
  where c.code = v_code
    and c.is_enabled
    and f.deleted_at is null
    and (c.expires_at is null or c.expires_at > now())
    and (c.max_uses is null or c.use_count < c.max_uses);
end;
$$;

create or replace function public.join_family_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_code text := roots.normalize_join_code(p_code);
  v_user uuid := auth.uid();
  v_row public.family_join_codes%rowtype;
  v_existing public.family_members%rowtype;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_code is null then
    raise exception 'that code is not valid' using errcode = 'P0002';
  end if;

  -- Locked for the duration: two people typing the last remaining use of a
  -- capped code at the same moment must not both get in.
  select c.* into v_row
  from public.family_join_codes c
  join public.families f on f.id = c.family_id
  where c.code = v_code
    and c.is_enabled
    and f.deleted_at is null
    and (c.expires_at is null or c.expires_at > now())
    and (c.max_uses is null or c.use_count < c.max_uses)
  for update of c;

  if not found then
    raise exception 'that code is not valid' using errcode = 'P0002';
  end if;

  select * into v_existing
  from public.family_members
  where family_id = v_row.family_id and user_id = v_user;

  if found then
    -- A suspended member is suspended. Letting a shared code undo an admin's
    -- decision would make suspension meaningless, so this is the one case that
    -- refuses rather than reinstating.
    if v_existing.status = 'suspended' then
      raise exception 'this account cannot rejoin that family' using errcode = '42501';
    end if;

    -- Otherwise they are already inside — someone who left, or was invited and
    -- typed the code instead of clicking the link. Hand back the family rather
    -- than an error, and never downgrade a role they already hold.
    if v_existing.status <> 'active' then
      update public.family_members
      set status = 'active'
      where id = v_existing.id;
    end if;
    return v_row.family_id;
  end if;

  insert into public.family_members (family_id, user_id, role, status)
  values (v_row.family_id, v_user, v_row.role, 'active');

  update public.family_join_codes
  set use_count = use_count + 1
  where family_id = v_row.family_id;

  perform roots.log_audit(v_row.family_id, 'family.joined_with_code', 'family', v_row.family_id,
                          jsonb_build_object('role', v_row.role));

  return v_row.family_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — signed-in users only, for every one of these.
-- ---------------------------------------------------------------------------
revoke all on function public.get_join_code(uuid) from public, anon;
revoke all on function public.rotate_join_code(uuid) from public, anon;
revoke all on function public.set_join_code_policy(uuid, boolean, family_role, timestamptz, integer) from public, anon;
revoke all on function public.preview_join_code(text) from public, anon;
revoke all on function public.join_family_with_code(text) from public, anon;

grant execute on function public.get_join_code(uuid) to authenticated;
grant execute on function public.rotate_join_code(uuid) to authenticated;
grant execute on function public.set_join_code_policy(uuid, boolean, family_role, timestamptz, integer) to authenticated;
grant execute on function public.preview_join_code(text) to authenticated;
grant execute on function public.join_family_with_code(text) to authenticated;

-- ======================================================================
-- 20260903000200_family_cover.sql
-- ======================================================================

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

-- ======================================================================
-- 20260903000300_edit_yourself.sql
-- ======================================================================

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

-- ======================================================================
-- 20260904000100_last_seen.sql
-- ======================================================================

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

-- ======================================================================
-- 20260904000200_family_locale.sql
-- ======================================================================

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

-- ======================================================================
-- 20260904000300_couple_spaces.sql
-- ======================================================================

set search_path = public, extensions;

-- ============================================================================
-- ROOTS — 0017 · The couple space
-- ----------------------------------------------------------------------------
-- ROOTS is an archive a whole family reads. This is the opposite: a space for
-- exactly two people, inside the same application, that the rest of the family
-- cannot see.
--
-- WHY A SEPARATE SET OF TABLES
--
-- The obvious implementation is a flag on `memories` and `media`. It is wrong,
-- and dangerously so. Every RLS policy on those tables grants access to
-- `roots.is_member(family_id)` — the whole family — and so do the storage
-- policies on the media bucket. A boolean column would have to be remembered in
-- every policy, every view, every join and every future query, and the first
-- place it was forgotten would quietly publish a couple's private letters to
-- their in-laws. Privacy that depends on remembering is not privacy.
--
-- So couple content lives in its own tables whose policies grant access to the
-- two partners and to nobody else — not even to the family owner. A query that
-- forgets the rule returns nothing rather than everything.
--
-- WHY IT HANGS OFF `couples`
--
-- A couple already exists in ROOTS: it is a row in `couples`, it has both
-- partners, a marriage date, children and its own page. Introducing a second,
-- parallel notion of "couple" keyed on user ids would mean two answers to
-- "are these two together", drifting apart from the day it shipped. The space
-- is therefore an ANNEX to the existing couple rather than a rival to it, which
-- is also what makes the family-tree integration free: the children already
-- hang off the same couple_id.
--
-- Membership is by USER, not by person, because a person in a tree is a
-- historical record and a user is someone who can log in. A great-grandmother
-- is a person; she is not going to open a private space.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- couple_spaces
-- ---------------------------------------------------------------------------
create table couple_spaces (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  -- One space per couple. The unique constraint is what stops two partners
  -- each creating their own half of the same story.
  couple_id     uuid not null unique references couples(id) on delete cascade,

  -- "Together since". Distinct from the couple's marriage_date on purpose: a
  -- relationship usually starts years before a wedding, and this is the date
  -- the two of them count from.
  started_on    date,
  how_we_met    text,

  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index couple_spaces_family_idx on couple_spaces (family_id) where deleted_at is null;

create trigger couple_spaces_touch before update on couple_spaces
  for each row execute function roots.touch_updated_at();

-- ---------------------------------------------------------------------------
-- The space cannot be re-pointed after it is opened
-- ---------------------------------------------------------------------------
-- couple_spaces_update grants both members, which is right for the start date
-- and the story — they should be able to fix those without a route. It would
-- also, without this, let either of them rewrite couple_id or family_id, moving
-- a space full of private letters onto a different relationship or into a
-- different family. Those two columns are the space's identity, not its
-- content, and identity is set once.
create or replace function roots.assert_couple_space_anchor()
returns trigger
language plpgsql
as $$
begin
  if new.couple_id is distinct from old.couple_id
     or new.family_id is distinct from old.family_id then
    raise exception 'a couple space cannot be moved to another couple or family'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger couple_spaces_anchor before update on couple_spaces
  for each row execute function roots.assert_couple_space_anchor();

-- ---------------------------------------------------------------------------
-- couple_space_members — who can open the space
-- ---------------------------------------------------------------------------
-- At most two rows per space, enforced below. This is the ONLY table that
-- decides who sees a couple's private content; every other policy in this
-- migration asks it.
create table couple_space_members (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references couple_spaces(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- Which partner in the tree this user is. Lets the space address them by the
  -- name the family already knows them by.
  person_id   uuid references people(id) on delete set null,
  joined_at   timestamptz not null default now(),
  unique (space_id, user_id)
);

create index couple_space_members_user_idx on couple_space_members (user_id);

-- A space for two. A third member is not a smaller privacy failure than a
-- public one, so the database refuses rather than the application remembering.
create or replace function roots.assert_couple_space_pair()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.couple_space_members where space_id = new.space_id;
  if v_count >= 2 then
    raise exception 'a couple space holds two people' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger couple_space_members_pair before insert on couple_space_members
  for each row execute function roots.assert_couple_space_pair();

-- ---------------------------------------------------------------------------
-- The access helper every policy below is built on.
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so it can read couple_space_members without recursing into
-- that table's own policies.
create or replace function roots.in_couple_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.couple_space_members m
    where m.space_id = p_space_id and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- couple_invitations — asking your person to join
-- ---------------------------------------------------------------------------
-- Only the hash of the token is stored. A leaked database backup must not hand
-- someone the key to a couple's private space, and the plaintext token exists
-- only in the link the inviter sends.
create table couple_invitations (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references couple_spaces(id) on delete cascade,
  token_hash   text not null unique,
  invited_by   uuid references auth.users(id) on delete set null,
  -- Who in the tree the invitation is for, so the space knows which partner
  -- accepted even before that user has a profile.
  for_person_id uuid references people(id) on delete set null,
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id) on delete set null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index couple_invitations_space_idx on couple_invitations (space_id)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- couple_media — the couple's own files
-- ---------------------------------------------------------------------------
-- Deliberately NOT the `media` table. See the note at the top: media's row
-- policies and the storage policies on family-media both grant the whole
-- family, and a private photograph must not depend on every one of those
-- remembering an exception.
create table couple_media (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references couple_spaces(id) on delete cascade,
  kind          media_kind not null,
  storage_bucket text not null default 'family-media',
  storage_path  text not null unique,
  mime_type     text,
  size_bytes    bigint check (size_bytes is null or size_bytes >= 0),
  width         integer,
  height        integer,
  duration_seconds numeric(10,2),
  caption       text,
  taken_at      timestamptz,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index couple_media_space_idx on couple_media (space_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- couple_memories
-- ---------------------------------------------------------------------------
create table couple_memories (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references couple_spaces(id) on delete cascade,
  created_by    uuid references auth.users(id) on delete set null,
  title         text not null check (length(btrim(title)) between 1 and 200),
  description   text,
  memory_date   date,
  date_precision date_precision not null default 'exact',
  -- Reuses the family's `locations` table: a place is a place, and the couple's
  -- first restaurant may well be somewhere the family already has a row for.
  location_id   uuid references locations(id) on delete set null,
  place_label   text,
  mood          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index couple_memories_space_idx on couple_memories (space_id, memory_date desc)
  where deleted_at is null;

create trigger couple_memories_touch before update on couple_memories
  for each row execute function roots.touch_updated_at();

-- Which files belong to which memory. A join table rather than a column on
-- couple_media so one photograph can illustrate a memory, a first and a place
-- without being uploaded three times.
create table couple_memory_media (
  memory_id  uuid not null references couple_memories(id) on delete cascade,
  media_id   uuid not null references couple_media(id) on delete cascade,
  position   integer not null default 0,
  primary key (memory_id, media_id)
);

-- ---------------------------------------------------------------------------
-- couple_letters
-- ---------------------------------------------------------------------------
-- A letter is addressed. Unlike everything else here it is not symmetric: the
-- sender wrote it and the recipient receives it, and a letter with an unlock
-- date is sealed from BOTH of them until then — a surprise the writer can
-- re-read is not a surprise.
create table couple_letters (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references couple_spaces(id) on delete cascade,
  sender_id     uuid not null references auth.users(id) on delete cascade,
  title         text not null check (length(btrim(title)) between 1 and 200),
  unlock_at     timestamptz,
  media_id      uuid references couple_media(id) on delete set null,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index couple_letters_space_idx on couple_letters (space_id, created_at desc)
  where deleted_at is null;

create trigger couple_letters_touch before update on couple_letters
  for each row execute function roots.touch_updated_at();

-- ---------------------------------------------------------------------------
-- couple_future_messages
-- ---------------------------------------------------------------------------
create table couple_future_messages (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references couple_spaces(id) on delete cascade,
  created_by  uuid references auth.users(id) on delete set null,
  title       text not null check (length(btrim(title)) between 1 and 200),
  unlock_at   timestamptz not null,
  media_id    uuid references couple_media(id) on delete set null,
  opened_at   timestamptz,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index couple_future_messages_space_idx on couple_future_messages (space_id, unlock_at);

-- ---------------------------------------------------------------------------
-- Sealed bodies — the reason letters and future messages are each two tables
-- ---------------------------------------------------------------------------
-- Postgres row-level security is exactly that: ROW level. There is no way to
-- return a row while withholding one of its columns, so a locked message whose
-- body lived alongside its title would be one `select *` away from being
-- readable years early — by a curious partner, by a mistake in a query, or by
-- anyone who ever gets a database console.
--
-- Splitting the body into its own table turns "not yet" into a row policy,
-- which Postgres CAN enforce absolutely. The clock is the database's `now()`,
-- not the client's; there is no request the application can make that returns a
-- sealed body early, because the database will not produce it.
create table couple_letter_bodies (
  letter_id uuid primary key references couple_letters(id) on delete cascade,
  body      text not null
);

create table couple_future_message_bodies (
  message_id uuid primary key references couple_future_messages(id) on delete cascade,
  body       text not null
);

-- ---------------------------------------------------------------------------
-- couple_places
-- ---------------------------------------------------------------------------
create table couple_places (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references couple_spaces(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 200),
  location_id uuid references locations(id) on delete set null,
  latitude    double precision check (latitude between -90 and 90),
  longitude   double precision check (longitude between -180 and 180),
  visited_on  date,
  notes       text,
  media_id    uuid references couple_media(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index couple_places_space_idx on couple_places (space_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- couple_firsts
-- ---------------------------------------------------------------------------
-- The "firsts" are a fixed vocabulary rather than free text, so the cards can
-- be laid out in a sensible order and the empty ones can invite being filled in
-- rather than simply not existing. `key` is text with a check constraint rather
-- than an enum: adding "our first winter" should not require a migration that
-- rewrites a type.
create table couple_firsts (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references couple_spaces(id) on delete cascade,
  key         text not null check (key in (
                'meeting', 'date', 'photo', 'trip', 'gift', 'movie',
                'i_love_you', 'anniversary', 'home'
              )),
  happened_on date,
  story       text,
  media_id    uuid references couple_media(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (space_id, key)
);

create trigger couple_firsts_touch before update on couple_firsts
  for each row execute function roots.touch_updated_at();

-- ---------------------------------------------------------------------------
-- couple_voice_memories
-- ---------------------------------------------------------------------------
-- A voice recording with a title and a date, pointing at a couple_media row of
-- kind 'audio'. Separate from couple_memories because a voice note is listened
-- to, not read, and mixing it into the photo grid buries it.
create table couple_voice_memories (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references couple_spaces(id) on delete cascade,
  media_id    uuid not null references couple_media(id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 200),
  description text,
  recorded_on date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index couple_voice_space_idx on couple_voice_memories (space_id, recorded_on desc)
  where deleted_at is null;

-- ============================================================================
-- Row level security
-- ----------------------------------------------------------------------------
-- Every policy below asks exactly one question: is the caller one of the two
-- people in this space? Not "are they in the family", not "are they an admin".
-- A family owner has no access here, and that is the point.
-- ============================================================================

alter table couple_spaces                enable row level security;
alter table couple_space_members         enable row level security;
alter table couple_invitations           enable row level security;
alter table couple_media                 enable row level security;
alter table couple_memories              enable row level security;
alter table couple_memory_media          enable row level security;
alter table couple_letters               enable row level security;
alter table couple_letter_bodies         enable row level security;
alter table couple_future_messages       enable row level security;
alter table couple_future_message_bodies enable row level security;
alter table couple_places                enable row level security;
alter table couple_firsts                enable row level security;
alter table couple_voice_memories        enable row level security;

-- ---- the space itself -----------------------------------------------------
-- No insert policy: a space is created through create_couple_space, which adds
-- the creator as a member in the same transaction. Without that, the row would
-- exist for an instant with nobody able to see it — including its author.
create policy couple_spaces_select on couple_spaces for select to authenticated
  using (roots.in_couple_space(id) and deleted_at is null);
create policy couple_spaces_update on couple_spaces for update to authenticated
  using (roots.in_couple_space(id)) with check (roots.in_couple_space(id));

create policy couple_space_members_select on couple_space_members for select to authenticated
  using (roots.in_couple_space(space_id));
-- Leaving is allowed; adding a partner goes through the invitation flow.
create policy couple_space_members_delete on couple_space_members for delete to authenticated
  using (user_id = auth.uid());

-- ---- invitations ----------------------------------------------------------
-- Readable only by the space, so an inviter can see a pending invitation and
-- revoke it. Accepting happens through a definer function, because the person
-- accepting is by definition not yet a member and so cannot see the row.
create policy couple_invitations_select on couple_invitations for select to authenticated
  using (roots.in_couple_space(space_id));
create policy couple_invitations_update on couple_invitations for update to authenticated
  using (roots.in_couple_space(space_id)) with check (roots.in_couple_space(space_id));

-- ---- content --------------------------------------------------------------
create policy couple_media_select on couple_media for select to authenticated
  using (roots.in_couple_space(space_id) and deleted_at is null);
create policy couple_media_insert on couple_media for insert to authenticated
  with check (roots.in_couple_space(space_id) and uploaded_by = auth.uid());
create policy couple_media_update on couple_media for update to authenticated
  using (roots.in_couple_space(space_id)) with check (roots.in_couple_space(space_id));

create policy couple_memories_select on couple_memories for select to authenticated
  using (roots.in_couple_space(space_id) and deleted_at is null);
create policy couple_memories_insert on couple_memories for insert to authenticated
  with check (roots.in_couple_space(space_id) and created_by = auth.uid());
create policy couple_memories_update on couple_memories for update to authenticated
  using (roots.in_couple_space(space_id)) with check (roots.in_couple_space(space_id));
create policy couple_memories_delete on couple_memories for delete to authenticated
  using (roots.in_couple_space(space_id));

create policy couple_memory_media_select on couple_memory_media for select to authenticated
  using (exists (select 1 from couple_memories m
                 where m.id = memory_id and roots.in_couple_space(m.space_id)));
create policy couple_memory_media_write on couple_memory_media for all to authenticated
  using (exists (select 1 from couple_memories m
                 where m.id = memory_id and roots.in_couple_space(m.space_id)))
  with check (exists (select 1 from couple_memories m
                      where m.id = memory_id and roots.in_couple_space(m.space_id)));

create policy couple_places_select on couple_places for select to authenticated
  using (roots.in_couple_space(space_id) and deleted_at is null);
create policy couple_places_write on couple_places for all to authenticated
  using (roots.in_couple_space(space_id)) with check (roots.in_couple_space(space_id));

create policy couple_firsts_select on couple_firsts for select to authenticated
  using (roots.in_couple_space(space_id));
create policy couple_firsts_write on couple_firsts for all to authenticated
  using (roots.in_couple_space(space_id)) with check (roots.in_couple_space(space_id));

create policy couple_voice_select on couple_voice_memories for select to authenticated
  using (roots.in_couple_space(space_id) and deleted_at is null);
create policy couple_voice_write on couple_voice_memories for all to authenticated
  using (roots.in_couple_space(space_id)) with check (roots.in_couple_space(space_id));

-- ---- letters --------------------------------------------------------------
-- The envelope is visible to both partners from the moment it is written: a
-- letter you can see waiting for you is most of the gift. Only the body waits.
create policy couple_letters_select on couple_letters for select to authenticated
  using (roots.in_couple_space(space_id) and deleted_at is null);
create policy couple_letters_insert on couple_letters for insert to authenticated
  with check (roots.in_couple_space(space_id) and sender_id = auth.uid());
-- Only the writer may change a letter, including its unlock date. Letting the
-- recipient update the row would let them move the date forward and read it.
create policy couple_letters_update on couple_letters for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy couple_letters_delete on couple_letters for delete to authenticated
  using (sender_id = auth.uid());

-- The seal itself. `now()` here is the DATABASE's clock — there is no request
-- the application can make, and no client-side value it can pass, that returns
-- a sealed body early. The writer keeps access to what they wrote; it is the
-- recipient the date is holding back.
create policy couple_letter_bodies_select on couple_letter_bodies for select to authenticated
  using (exists (
    select 1 from couple_letters l
    where l.id = letter_id
      and roots.in_couple_space(l.space_id)
      and l.deleted_at is null
      and (l.unlock_at is null or l.unlock_at <= now() or l.sender_id = auth.uid())
  ));
create policy couple_letter_bodies_write on couple_letter_bodies for all to authenticated
  using (exists (select 1 from couple_letters l where l.id = letter_id and l.sender_id = auth.uid()))
  with check (exists (select 1 from couple_letters l where l.id = letter_id and l.sender_id = auth.uid()));

-- ---- future messages ------------------------------------------------------
-- Sealed from BOTH of them, the writer included. A message to your future
-- selves that you can re-read tonight is a draft, not a message; and the writer
-- being able to peek is exactly the hole a recipient would ask them to open.
--
-- There is no update policy at all, deliberately: the only way to reveal one of
-- these early would be to move its unlock_at, so nobody can move it.
create policy couple_future_select on couple_future_messages for select to authenticated
  using (roots.in_couple_space(space_id) and deleted_at is null);
create policy couple_future_insert on couple_future_messages for insert to authenticated
  with check (roots.in_couple_space(space_id) and created_by = auth.uid());
-- Deletable by its author, so a mistake is not permanent for five years.
create policy couple_future_delete on couple_future_messages for delete to authenticated
  using (created_by = auth.uid());

create policy couple_future_bodies_select on couple_future_message_bodies for select to authenticated
  using (exists (
    select 1 from couple_future_messages f
    where f.id = message_id
      and roots.in_couple_space(f.space_id)
      and f.deleted_at is null
      and f.unlock_at <= now()
  ));
-- Write once, at creation. No update policy: see above.
create policy couple_future_bodies_insert on couple_future_message_bodies for insert to authenticated
  with check (exists (
    select 1 from couple_future_messages f
    where f.id = message_id and f.created_by = auth.uid()
  ));

-- ============================================================================
-- Storage — the private prefix
-- ============================================================================
-- Couple files live at families/{family}/couple-space/{space}/... inside the
-- same bucket. That is convenient but not sufficient: the existing read policy
-- grants any family member anything under families/{family}/, so without the
-- exclusion below a brother-in-law with a path could fetch a signed URL.
--
-- Policies are OR'd, so the private prefix has to be carved OUT of the family
-- policy as well as granted to the couple. Adding the couple policy alone would
-- change nothing at all.
create or replace function roots.couple_space_from_object_path(p_path text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_parts text[];
begin
  v_parts := string_to_array(p_path, '/');
  if array_length(v_parts, 1) < 5 or v_parts[1] <> 'families' or v_parts[3] <> 'couple-space' then
    return null;
  end if;
  return v_parts[4]::uuid;
exception
  when others then
    return null;
end;
$$;

drop policy if exists "family media read" on storage.objects;
create policy "family media read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'family-media'
    and roots.family_from_object_path(name) is not null
    and roots.is_member(roots.family_from_object_path(name))
    -- The couple's own prefix is not the family's to read.
    and roots.couple_space_from_object_path(name) is null
  );

drop policy if exists "family media insert" on storage.objects;
create policy "family media insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'family-media'
    and roots.family_from_object_path(name) is not null
    and roots.can_contribute(roots.family_from_object_path(name))
    and roots.couple_space_from_object_path(name) is null
  );

drop policy if exists "couple space media read" on storage.objects;
create policy "couple space media read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'family-media'
    and roots.couple_space_from_object_path(name) is not null
    and roots.in_couple_space(roots.couple_space_from_object_path(name))
  );

drop policy if exists "couple space media insert" on storage.objects;
create policy "couple space media insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'family-media'
    and roots.couple_space_from_object_path(name) is not null
    and roots.in_couple_space(roots.couple_space_from_object_path(name))
  );

-- ============================================================================
-- RPCs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- create_couple_space — opening the space, and joining it, in one transaction
-- ---------------------------------------------------------------------------
-- Definer for two reasons. The obvious one: the row and its first member must
-- appear together or not at all, and a plain insert would create a space its
-- own author could not see. The second: this is where "may I open a space for
-- this couple" is decided, and that question is not answered by the family
-- role. An editor may edit anyone's marriage date; only the two people IN a
-- relationship may open its private space.
create or replace function public.create_couple_space(
  p_couple_id uuid,
  p_started_on date default null,
  p_how_we_met text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_couple public.couples%rowtype;
  v_person_id uuid;
  v_space_id uuid;
begin
  select * into v_couple from public.couples where id = p_couple_id and deleted_at is null;
  if not found then
    raise exception 'couple not found' using errcode = 'P0002';
  end if;

  if not roots.is_member(v_couple.family_id) then
    raise exception 'couple not found' using errcode = 'P0002';
  end if;

  -- Which person in the tree the caller is. A member who is not linked to a
  -- person cannot be in a relationship, because ROOTS does not know who they
  -- are yet.
  select person_id into v_person_id
  from public.family_members
  where family_id = v_couple.family_id and user_id = auth.uid() and status = 'active';

  if v_person_id is null or v_person_id not in (v_couple.person_a_id, v_couple.person_b_id) then
    raise exception 'only the two people in a relationship can open its space'
      using errcode = '42501';
  end if;

  -- The partner may have opened it first. They can see it and the caller
  -- cannot — RLS hides it — so without this check the caller would hit a bare
  -- unique-violation and be told nothing useful.
  if exists (select 1 from public.couple_spaces where couple_id = p_couple_id and deleted_at is null) then
    raise exception 'your partner has already opened this space; ask them for the link'
      using errcode = '23505';
  end if;

  insert into public.couple_spaces (family_id, couple_id, started_on, how_we_met, created_by)
  values (
    v_couple.family_id, p_couple_id,
    coalesce(p_started_on, v_couple.relationship_start, v_couple.marriage_date),
    nullif(btrim(p_how_we_met), ''),
    auth.uid()
  )
  returning id into v_space_id;

  insert into public.couple_space_members (space_id, user_id, person_id)
  values (v_space_id, auth.uid(), v_person_id);

  -- Deliberately NOT audit-logged with any content. The family's audit log is
  -- readable by admins, and "they opened a private space" is already more than
  -- an in-law needs to know.
  return v_space_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- invite_to_couple_space — asking your person to join
-- ---------------------------------------------------------------------------
-- Returns the plaintext token exactly once. Only its hash is stored, so a
-- database backup does not hand anyone the key to a couple's letters.
create or replace function public.invite_to_couple_space(p_space_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_space public.couple_spaces%rowtype;
  v_couple public.couples%rowtype;
  v_mine uuid;
  v_other uuid;
  v_token text;
begin
  if not roots.in_couple_space(p_space_id) then
    raise exception 'space not found' using errcode = 'P0002';
  end if;

  if (select count(*) from public.couple_space_members where space_id = p_space_id) >= 2 then
    raise exception 'both of you are already here' using errcode = '23514';
  end if;

  select * into v_space from public.couple_spaces where id = p_space_id;
  select * into v_couple from public.couples where id = v_space.couple_id;

  select person_id into v_mine from public.couple_space_members
  where space_id = p_space_id and user_id = auth.uid();

  -- The invitation is for the OTHER partner, named from the tree. It is not an
  -- open link: whoever accepts is recorded as that person.
  v_other := case when v_mine = v_couple.person_a_id then v_couple.person_b_id
                  else v_couple.person_a_id end;

  -- Any earlier outstanding invitation is superseded. Two live links to the
  -- same private space is one more than anybody needs.
  update public.couple_invitations
  set revoked_at = now()
  where space_id = p_space_id and accepted_at is null and revoked_at is null;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.couple_invitations (space_id, token_hash, invited_by, for_person_id)
  values (p_space_id, encode(digest(v_token, 'sha256'), 'hex'), auth.uid(), v_other);

  return v_token;
end;
$$;

-- Look at an invitation before accepting it. Says who is inviting you and to
-- what; says nothing about the contents of the space.
create or replace function public.preview_couple_invitation(p_token text)
returns table (space_id uuid, inviter_name text, partner_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
begin
  return query
  select i.space_id,
         coalesce(pr.display_name, 'Танай хүн'),
         coalesce(pe.first_name, ''),
         i.expires_at
  from public.couple_invitations i
  join public.couple_spaces s on s.id = i.space_id
  left join public.profiles pr on pr.id = i.invited_by
  left join public.people pe on pe.id = i.for_person_id
  where i.token_hash = v_hash
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and s.deleted_at is null;
end;
$$;

create or replace function public.accept_couple_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_inv public.couple_invitations%rowtype;
  v_space public.couple_spaces%rowtype;
  v_hash text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
begin
  select * into v_inv from public.couple_invitations
  where token_hash = v_hash and accepted_at is null and revoked_at is null and expires_at > now();

  if not found then
    raise exception 'this invitation is no longer valid' using errcode = 'P0002';
  end if;

  select * into v_space from public.couple_spaces where id = v_inv.space_id and deleted_at is null;
  if not found then
    raise exception 'this invitation is no longer valid' using errcode = 'P0002';
  end if;

  -- Already in it: accepting twice is not an error, it is a double-click.
  if roots.in_couple_space(v_inv.space_id) then
    return v_inv.space_id;
  end if;

  -- The accepting user must be a member of the same family. The couple space is
  -- private FROM the family, but it is not outside it.
  if not roots.is_member(v_space.family_id) then
    raise exception 'this invitation is no longer valid' using errcode = 'P0002';
  end if;

  insert into public.couple_space_members (space_id, user_id, person_id)
  values (v_inv.space_id, auth.uid(), v_inv.for_person_id);

  -- Link the accepting account to the person in the tree if it is not linked
  -- yet, so the rest of ROOTS can say how they are related to everyone else.
  update public.family_members
  set person_id = v_inv.for_person_id
  where family_id = v_space.family_id and user_id = auth.uid() and person_id is null
    and v_inv.for_person_id is not null;

  update public.couple_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_inv.id;

  return v_inv.space_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- open_future_message / mark_letter_read
-- ---------------------------------------------------------------------------
-- The tables have no update policy, on purpose: the only way to reveal a sealed
-- message early would be to move its unlock date, so nobody can move anything.
-- These two functions exist to write the one field that is not a secret.
create or replace function public.open_future_message(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_msg public.couple_future_messages%rowtype;
begin
  select * into v_msg from public.couple_future_messages where id = p_id and deleted_at is null;
  if not found or not roots.in_couple_space(v_msg.space_id) then
    raise exception 'message not found' using errcode = 'P0002';
  end if;
  if v_msg.unlock_at > now() then
    raise exception 'not yet' using errcode = '42501';
  end if;

  update public.couple_future_messages
  set opened_at = coalesce(opened_at, now())
  where id = p_id;
end;
$$;

create or replace function public.mark_letter_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_letter public.couple_letters%rowtype;
begin
  select * into v_letter from public.couple_letters where id = p_id and deleted_at is null;
  if not found or not roots.in_couple_space(v_letter.space_id) then
    raise exception 'letter not found' using errcode = 'P0002';
  end if;
  -- The writer re-reading their own letter is not the recipient opening it.
  if v_letter.sender_id = auth.uid() then return; end if;
  if v_letter.unlock_at is not null and v_letter.unlock_at > now() then return; end if;

  update public.couple_letters set read_at = coalesce(read_at, now()) where id = p_id;
end;
$$;

revoke all on function public.create_couple_space(uuid, date, text) from public, anon;
revoke all on function public.invite_to_couple_space(uuid) from public, anon;
revoke all on function public.preview_couple_invitation(text) from public, anon;
revoke all on function public.accept_couple_invitation(text) from public, anon;
revoke all on function public.open_future_message(uuid) from public, anon;
revoke all on function public.mark_letter_read(uuid) from public, anon;

grant execute on function public.create_couple_space(uuid, date, text) to authenticated;
grant execute on function public.invite_to_couple_space(uuid) to authenticated;
grant execute on function public.preview_couple_invitation(text) to authenticated;
grant execute on function public.accept_couple_invitation(text) to authenticated;
grant execute on function public.open_future_message(uuid) to authenticated;
grant execute on function public.mark_letter_read(uuid) to authenticated;
