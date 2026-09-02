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
