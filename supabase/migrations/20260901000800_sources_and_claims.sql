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
