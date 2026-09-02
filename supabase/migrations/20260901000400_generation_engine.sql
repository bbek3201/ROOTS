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
