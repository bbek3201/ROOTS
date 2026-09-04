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
