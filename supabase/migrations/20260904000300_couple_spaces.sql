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
