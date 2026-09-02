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
