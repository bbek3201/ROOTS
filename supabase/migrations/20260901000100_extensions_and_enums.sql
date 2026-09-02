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
