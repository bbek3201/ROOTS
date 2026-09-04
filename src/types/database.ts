/**
 * Database types.
 *
 * NOTE: every row type here is a `type` alias, never an `interface`. Supabase's
 * GenericSchema constraint requires `Record<string, unknown>` compatibility,
 * and TypeScript only gives implicit index signatures to type aliases. Declare
 * one of these as an interface and the client silently degrades to `any` —
 * every query still compiles, and none of them are type-checked any more.
 *
 * Hand-maintained to mirror supabase/migrations. Run `npm run db:types` against
 * a live project to regenerate this file exactly; it is checked in so that
 * `npm run typecheck` works without a database connection.
 *
 * Insert/Update shapes are derived from Row rather than spelled out three
 * times, so a column added in a migration is added here exactly once.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Columns the database always fills in itself. */
type Generated = 'id' | 'created_at' | 'updated_at';

type Table<Row, RequiredOnInsert extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Omit<Row, Generated>> & Pick<Row, RequiredOnInsert>;
  Update: Partial<Omit<Row, 'id' | 'created_at'>>;
  Relationships: [];
};

type ViewTable<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type FamilyRole = 'owner' | 'admin' | 'editor' | 'contributor' | 'viewer';
export type MembershipStatus = 'active' | 'invited' | 'suspended' | 'left';
export type GenderBucket = 'male' | 'female' | 'other' | 'unknown';
export type LifeStatus = 'living' | 'deceased' | 'unknown';
export type DatePrecision = 'exact' | 'month' | 'year' | 'decade' | 'about' | 'unknown';
export type ParentChildType = 'biological' | 'adoptive' | 'step' | 'foster' | 'guardian' | 'unknown';
export type CoupleType = 'marriage' | 'partnership' | 'engagement' | 'unknown';
export type CoupleStatus = 'together' | 'separated' | 'divorced' | 'widowed' | 'ended' | 'unknown';
export type MemoryType =
  | 'story' | 'photo' | 'video' | 'audio' | 'document' | 'letter' | 'recipe'
  | 'tradition' | 'event' | 'note';
export type MediaKind = 'photo' | 'video' | 'audio' | 'document';
export type MediaVariant =
  | 'original' | 'thumbnail' | 'web' | 'restored' | 'colorized' | 'enhanced' | 'cropped' | 'transcoded';
export type DocumentType = 'letter' | 'certificate' | 'id_document' | 'record' | 'newspaper' | 'diary' | 'other';
export type ProcessingStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export type SourceType =
  | 'family_interview' | 'photograph' | 'document' | 'relative' | 'user_entry'
  | 'official_record' | 'gravestone' | 'external' | 'unknown';
export type ClaimStatus = 'active' | 'disputed' | 'superseded' | 'retracted';
export type ConfidenceLevel = 'certain' | 'probable' | 'uncertain' | 'disputed';
export type InterviewStatus = 'draft' | 'in_progress' | 'paused' | 'completed' | 'archived';
export type AiTask =
  | 'transcribe' | 'summarize' | 'extract_timeline' | 'analyze_photo' | 'ocr'
  | 'answer_question' | 'generate_story' | 'organize_appearance' | 'embed';
export type AppearanceSource = 'photograph' | 'family_description' | 'ai_summary';

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------
export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  locale: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type FamilyRow = {
  id: string;
  name: string;
  description: string | null;
  root_couple_id: string | null;
  root_person_id: string | null;
  /** The photograph the whole family is shown under. */
  cover_media_id: string | null;
  visible_generations: number;
  default_locale: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** The short, spoken code that lets a relative into the archive. */
export type FamilyJoinCodeRow = {
  family_id: string;
  code: string;
  role: Extract<FamilyRole, 'viewer' | 'contributor' | 'editor'>;
  is_enabled: boolean;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  created_by: string | null;
  rotated_at: string;
  created_at: string;
  updated_at: string;
};

export type FamilyMemberRow = {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyRole;
  status: MembershipStatus;
  person_id: string | null;
  invited_by: string | null;
  joined_at: string;
  /** Null means this member has never opened the family — nothing is "new" yet. */
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LocationRow = {
  id: string;
  family_id: string;
  name: string;
  detail: string | null;
  admin_area: string | null;
  country: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  historical_name: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonRow = {
  id: string;
  family_id: string;
  first_name: string;
  last_name: string | null;
  nickname: string | null;
  name_in_source: string | null;
  gender: GenderBucket;
  gender_label: string | null;
  birth_date: string | null;
  birth_date_precision: DatePrecision;
  death_date: string | null;
  death_date_precision: DatePrecision;
  life_status: LifeStatus;
  birth_place_id: string | null;
  death_place_id: string | null;
  occupation: string | null;
  education: string | null;
  biography: string | null;
  profile_photo_media_id: string | null;
  generation: number | null;
  generation_computed_at: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CoupleRow = {
  id: string;
  family_id: string;
  person_a_id: string;
  person_b_id: string | null;
  relationship_type: CoupleType;
  status: CoupleStatus;
  relationship_start: string | null;
  relationship_end: string | null;
  marriage_date: string | null;
  marriage_place_id: string | null;
  story: string | null;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ParentChildRow = {
  id: string;
  family_id: string;
  parent_id: string;
  child_id: string;
  couple_id: string | null;
  relationship_type: ParentChildType;
  certainty: ConfidenceLevel;
  source_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonLocationRow = {
  id: string;
  family_id: string;
  person_id: string;
  location_id: string;
  kind: string;
  from_date: string | null;
  to_date: string | null;
  notes: string | null;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type MemoryRow = {
  id: string;
  family_id: string;
  type: MemoryType;
  title: string;
  description: string | null;
  body: string | null;
  memory_date: string | null;
  date_precision: DatePrecision;
  end_date: string | null;
  location_id: string | null;
  contributor_id: string | null;
  contributor_name: string;
  couple_id: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type MemoryPersonRow = {
  id: string;
  family_id: string;
  memory_id: string;
  person_id: string;
  role: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type MediaRow = {
  id: string;
  family_id: string;
  kind: MediaKind;
  variant: MediaVariant;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  derived_from_id: string | null;
  generated_by: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  caption: string | null;
  taken_at: string | null;
  taken_date_precision: DatePrecision;
  location_id: string | null;
  memory_id: string | null;
  person_id: string | null;
  couple_id: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PhotoRow = {
  media_id: string;
  family_id: string;
  is_scanned: boolean;
  is_colorized: boolean;
  is_restored: boolean;
  orientation: number | null;
  camera: string | null;
  analysis_status: ProcessingStatus;
};

export type VideoRow = {
  media_id: string;
  family_id: string;
  resolution: string | null;
  has_audio: boolean;
  transcript_status: ProcessingStatus;
};

export type AudioRecordingRow = {
  media_id: string;
  family_id: string;
  speaker_person_id: string | null;
  recorded_at: string | null;
  interview_id: string | null;
  language: string | null;
  transcript_status: ProcessingStatus;
  voice_cloning_consent: boolean;
  consent_recorded_by: string | null;
  consent_recorded_at: string | null;
};

export type DocumentRow = {
  media_id: string;
  family_id: string;
  doc_type: DocumentType;
  page_count: number | null;
  language: string | null;
  ocr_status: ProcessingStatus;
  ocr_text: string | null;
};

export type PhotoPersonTagRow = {
  id: string;
  family_id: string;
  media_id: string;
  person_id: string;
  box_x: number | null;
  box_y: number | null;
  box_width: number | null;
  box_height: number | null;
  suggested_by_ai: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_by: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Couple space — the private half of ROOTS
// ---------------------------------------------------------------------------
// These mirror supabase/migrations/20260904000300_couple_spaces.sql. They are
// deliberately NOT reusing MemoryRow or MediaRow: the family tables and the
// couple tables carry different access rules, and a shared type would make it
// easy to hand a row from one to a function written for the other.

/** The nine "firsts" a couple can fill in. Fixed, so the cards have an order. */
export type CoupleFirstKey =
  | 'meeting' | 'date' | 'photo' | 'trip' | 'gift' | 'movie'
  | 'i_love_you' | 'anniversary' | 'home';

export type CoupleSpaceRow = {
  id: string;
  family_id: string;
  couple_id: string;
  /** "Together since" — usually earlier than the wedding. */
  started_on: string | null;
  how_we_met: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CoupleSpaceMemberRow = {
  id: string;
  space_id: string;
  user_id: string;
  person_id: string | null;
  joined_at: string;
};

export type CoupleInvitationRow = {
  id: string;
  space_id: string;
  token_hash: string;
  invited_by: string | null;
  for_person_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type CoupleMediaRow = {
  id: string;
  space_id: string;
  kind: MediaKind;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  caption: string | null;
  taken_at: string | null;
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type CoupleMemoryRow = {
  id: string;
  space_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  memory_date: string | null;
  date_precision: DatePrecision;
  location_id: string | null;
  place_label: string | null;
  mood: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CoupleMemoryMediaRow = {
  memory_id: string;
  media_id: string;
  position: number;
};

export type CoupleLetterRow = {
  id: string;
  space_id: string;
  sender_id: string;
  title: string;
  /** Null means readable now. */
  unlock_at: string | null;
  media_id: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** The sealed half. A row that comes back at all is a row you may read. */
export type CoupleLetterBodyRow = { letter_id: string; body: string };

export type CoupleFutureMessageRow = {
  id: string;
  space_id: string;
  created_by: string | null;
  title: string;
  unlock_at: string;
  media_id: string | null;
  opened_at: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type CoupleFutureMessageBodyRow = { message_id: string; body: string };

export type CouplePlaceRow = {
  id: string;
  space_id: string;
  name: string;
  location_id: string | null;
  latitude: number | null;
  longitude: number | null;
  visited_on: string | null;
  notes: string | null;
  media_id: string | null;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type CoupleFirstRow = {
  id: string;
  space_id: string;
  key: CoupleFirstKey;
  happened_on: string | null;
  story: string | null;
  media_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CoupleVoiceMemoryRow = {
  id: string;
  space_id: string;
  media_id: string;
  title: string;
  description: string | null;
  recorded_on: string | null;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type LifeEventRow = {
  id: string;
  family_id: string;
  person_id: string | null;
  couple_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string | null;
  date_precision: DatePrecision;
  end_date: string | null;
  location_id: string | null;
  source_id: string | null;
  memory_id: string | null;
  is_ai_extracted: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TimelineEventRow = {
  id: string;
  family_id: string;
  scope: string;
  generation: number | null;
  title: string;
  description: string | null;
  event_date: string | null;
  date_precision: DatePrecision;
  end_date: string | null;
  location_id: string | null;
  source_id: string | null;
  is_milestone: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type InterviewQuestionSetRow = {
  id: string;
  family_id: string | null;
  key: string;
  title: string;
  description: string | null;
  locale: string;
  audience: string;
  is_builtin: boolean;
  created_by: string | null;
  created_at: string;
};

export type InterviewQuestionTemplateRow = {
  id: string;
  set_id: string;
  order_index: number;
  question_key: string;
  question_text: string;
  hint: string | null;
  expects: string;
};

export type InterviewRow = {
  id: string;
  family_id: string;
  subject_person_id: string;
  interviewer_id: string | null;
  interviewer_name: string | null;
  set_id: string | null;
  title: string | null;
  status: InterviewStatus;
  language: string;
  ai_summary: string | null;
  ai_output_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type InterviewQuestionRow = {
  id: string;
  family_id: string;
  interview_id: string;
  order_index: number;
  question_key: string | null;
  question_text: string;
  audio_media_id: string | null;
  skipped: boolean;
  answered_at: string | null;
  created_at: string;
};

export type InterviewTranscriptRow = {
  id: string;
  family_id: string;
  interview_id: string;
  question_id: string | null;
  audio_media_id: string | null;
  transcript_text: string;
  language: string;
  segments: Json | null;
  confidence: number | null;
  provider: string;
  model: string | null;
  is_mock: boolean;
  original_text: string | null;
  is_edited: boolean;
  edited_by: string | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiOutputRow = {
  id: string;
  family_id: string;
  task: AiTask;
  provider: string;
  model: string | null;
  is_mock: boolean;
  subject_type: string | null;
  subject_id: string | null;
  input_summary: string | null;
  output_text: string | null;
  output_json: Json | null;
  grounded_on: Json;
  token_usage: Json | null;
  latency_ms: number | null;
  created_by: string | null;
  created_at: string;
};

export type AppearanceDescriptionRow = {
  id: string;
  family_id: string;
  person_id: string;
  source_kind: AppearanceSource;
  description: string;
  attributes: Json;
  narration_text: string | null;
  based_on_media_id: string | null;
  ai_output_id: string | null;
  is_ai_generated: boolean;
  contributed_by: string | null;
  contributor_name: string;
  source_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceRow = {
  id: string;
  family_id: string;
  source_type: SourceType;
  title: string;
  description: string | null;
  media_id: string | null;
  interview_id: string | null;
  document_media_id: string | null;
  url: string | null;
  informant_person_id: string | null;
  reliability: ConfidenceLevel;
  recorded_at: string | null;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

export type FactClaimRow = {
  id: string;
  family_id: string;
  subject_type: string;
  subject_id: string;
  field_key: string;
  value_text: string | null;
  value_date: string | null;
  value_number: number | null;
  value_uuid: string | null;
  source_id: string | null;
  claimed_by: string | null;
  claimed_by_name: string;
  confidence: ConfidenceLevel;
  status: ClaimStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InvitationRow = {
  id: string;
  family_id: string;
  email: string | null;
  role: FamilyRole;
  token_hash: string;
  person_id: string | null;
  message: string | null;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  family_id: string | null;
  actor_user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Json;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type PersonTimelineRow = {
  family_id: string;
  person_id: string;
  entry_id: string;
  entry_kind: 'life_event' | 'couple_event' | 'memory';
  event_type: string;
  title: string;
  description: string | null;
  event_date: string | null;
  date_precision: DatePrecision;
  location_id: string | null;
  is_ai_extracted: boolean;
  confirmed_at: string | null;
  created_at: string;
};

export type PersonPhotoRow = {
  person_id: string;
  media_id: string;
  family_id: string;
  storage_bucket: string;
  storage_path: string;
  variant: MediaVariant;
  caption: string | null;
  taken_at: string | null;
  via: 'tagged' | 'attached' | 'memory';
};

export type FactConflictRow = {
  family_id: string;
  subject_type: string;
  subject_id: string;
  field_key: string;
  claim_count: number;
  distinct_values: number;
};

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'id' | 'display_name'>;
      families: Table<FamilyRow, 'name'>;
      family_members: Table<FamilyMemberRow, 'family_id' | 'user_id'>;
      family_join_codes: Table<FamilyJoinCodeRow, 'family_id' | 'code'>;
      locations: Table<LocationRow, 'family_id' | 'name'>;
      people: Table<PersonRow, 'family_id' | 'first_name'>;
      couples: Table<CoupleRow, 'family_id' | 'person_a_id'>;
      parent_child_relationships: Table<ParentChildRow, 'family_id' | 'parent_id' | 'child_id'>;
      person_locations: Table<PersonLocationRow, 'family_id' | 'person_id' | 'location_id'>;
      memories: Table<MemoryRow, 'family_id' | 'title' | 'contributor_name'>;
      memory_people: Table<MemoryPersonRow, 'family_id' | 'memory_id' | 'person_id'>;
      media: Table<MediaRow, 'family_id' | 'kind' | 'storage_path' | 'uploaded_by_name'>;
      photos: Table<PhotoRow, 'media_id' | 'family_id'>;
      videos: Table<VideoRow, 'media_id' | 'family_id'>;
      audio_recordings: Table<AudioRecordingRow, 'media_id' | 'family_id'>;
      documents: Table<DocumentRow, 'media_id' | 'family_id'>;
      photo_people_tags: Table<PhotoPersonTagRow, 'family_id' | 'media_id' | 'person_id'>;
      couple_spaces: Table<CoupleSpaceRow, 'family_id' | 'couple_id'>;
      couple_space_members: Table<CoupleSpaceMemberRow, 'space_id' | 'user_id'>;
      couple_invitations: Table<CoupleInvitationRow, 'space_id' | 'token_hash'>;
      couple_media: Table<CoupleMediaRow, 'space_id' | 'kind' | 'storage_path'>;
      couple_memories: Table<CoupleMemoryRow, 'space_id' | 'title'>;
      couple_memory_media: Table<CoupleMemoryMediaRow, 'memory_id' | 'media_id'>;
      couple_letters: Table<CoupleLetterRow, 'space_id' | 'sender_id' | 'title'>;
      couple_letter_bodies: Table<CoupleLetterBodyRow, 'letter_id' | 'body'>;
      couple_future_messages: Table<CoupleFutureMessageRow, 'space_id' | 'title' | 'unlock_at'>;
      couple_future_message_bodies: Table<CoupleFutureMessageBodyRow, 'message_id' | 'body'>;
      couple_places: Table<CouplePlaceRow, 'space_id' | 'name'>;
      couple_firsts: Table<CoupleFirstRow, 'space_id' | 'key'>;
      couple_voice_memories: Table<CoupleVoiceMemoryRow, 'space_id' | 'media_id' | 'title'>;
      life_events: Table<LifeEventRow, 'family_id' | 'title'>;
      timeline_events: Table<TimelineEventRow, 'family_id' | 'title'>;
      interview_question_sets: Table<InterviewQuestionSetRow, 'key' | 'title'>;
      interview_question_templates: Table<InterviewQuestionTemplateRow, 'set_id' | 'order_index' | 'question_key' | 'question_text'>;
      interviews: Table<InterviewRow, 'family_id' | 'subject_person_id'>;
      interview_questions: Table<InterviewQuestionRow, 'family_id' | 'interview_id' | 'order_index' | 'question_text'>;
      interview_transcripts: Table<InterviewTranscriptRow, 'family_id' | 'interview_id' | 'transcript_text'>;
      ai_outputs: Table<AiOutputRow, 'family_id' | 'task' | 'provider'>;
      appearance_descriptions: Table<AppearanceDescriptionRow, 'family_id' | 'person_id' | 'source_kind' | 'description' | 'contributor_name'>;
      sources: Table<SourceRow, 'family_id' | 'title' | 'created_by_name'>;
      fact_claims: Table<FactClaimRow, 'family_id' | 'subject_type' | 'subject_id' | 'field_key' | 'claimed_by_name'>;
      invitations: Table<InvitationRow, 'family_id' | 'token_hash'>;
      audit_logs: Table<AuditLogRow, 'action'>;
    };
    Views: {
      person_timeline: ViewTable<PersonTimelineRow>;
      person_photos: ViewTable<PersonPhotoRow>;
      fact_conflicts: ViewTable<FactConflictRow>;
    };
    Functions: {
      create_family: { Args: { p_name: string; p_description?: string | null; p_locale?: string }; Returns: string };
      add_person: {
        Args: {
          p_family_id: string; p_first_name: string; p_last_name?: string | null;
          p_gender?: GenderBucket; p_birth_date?: string | null; p_death_date?: string | null;
          p_nickname?: string | null; p_birth_place_id?: string | null;
          p_occupation?: string | null; p_biography?: string | null;
        };
        Returns: string;
      };
      create_couple: {
        Args: {
          p_family_id: string; p_person_one: string; p_person_two?: string | null;
          p_relationship_type?: CoupleType; p_marriage_date?: string | null;
          p_relationship_start?: string | null; p_status?: CoupleStatus;
        };
        Returns: string;
      };
      link_child_to_couple: {
        Args: { p_couple_id: string; p_child_id: string; p_relationship_type?: ParentChildType };
        Returns: undefined;
      };
      add_child_to_couple: {
        Args: {
          p_couple_id: string; p_first_name: string; p_last_name?: string | null;
          p_gender?: GenderBucket; p_birth_date?: string | null; p_nickname?: string | null;
          p_relationship_type?: ParentChildType;
        };
        Returns: string;
      };
      add_parent_couple: {
        Args: {
          p_family_id: string; p_child_id: string; p_parent_one_id: string;
          p_parent_two_id?: string | null; p_marriage_date?: string | null;
        };
        Returns: string;
      };
      get_family_graph: { Args: { p_family_id: string }; Returns: Json };
      search_family: {
        Args: { p_family_id: string; p_query: string; p_limit?: number };
        Returns: Array<{
          result_type: string; result_id: string; title: string;
          subtitle: string | null; snippet: string | null;
          event_date: string | null; rank: number;
        }>;
      };
      create_invitation: {
        Args: {
          p_family_id: string; p_role?: FamilyRole; p_email?: string | null;
          p_person_id?: string | null; p_message?: string | null; p_expires_in_days?: number;
        };
        Returns: Array<{ invitation_id: string; token: string }>;
      };
      preview_invitation: {
        Args: { p_token: string };
        Returns: Array<{
          family_id: string; family_name: string; role: FamilyRole;
          invited_by_name: string; expires_at: string;
        }>;
      };
      accept_invitation: { Args: { p_token: string }; Returns: string };
      get_join_code: {
        Args: { p_family_id: string };
        Returns: Array<{
          code: string; role: FamilyRole; is_enabled: boolean;
          expires_at: string | null; max_uses: number | null;
          use_count: number; rotated_at: string;
        }>;
      };
      rotate_join_code: { Args: { p_family_id: string }; Returns: string };
      set_join_code_policy: {
        Args: {
          p_family_id: string; p_is_enabled?: boolean | null; p_role?: FamilyRole | null;
          p_expires_at?: string | null; p_max_uses?: number | null;
        };
        Returns: undefined;
      };
      preview_join_code: {
        Args: { p_code: string };
        Returns: Array<{
          family_id: string; family_name: string; role: FamilyRole; member_count: number;
        }>;
      };
      join_family_with_code: { Args: { p_code: string }; Returns: string };
      update_my_person: {
        Args: {
          p_person_id: string; p_biography?: string | null;
          p_nickname?: string | null; p_photo_media_id?: string | null;
        };
        Returns: undefined;
      };
      set_family_cover: {
        Args: { p_family_id: string; p_media_id?: string | null };
        Returns: undefined;
      };
      /** Marks this visit and returns the PREVIOUS mark, which is what "new since" means. */
      touch_last_seen: { Args: { p_family_id: string }; Returns: string | null };
      set_family_locale: { Args: { p_family_id: string; p_locale: string }; Returns: undefined };
      create_couple_space: {
        Args: { p_couple_id: string; p_started_on?: string | null; p_how_we_met?: string | null };
        Returns: string;
      };
      invite_to_couple_space: { Args: { p_space_id: string }; Returns: string };
      preview_couple_invitation: {
        Args: { p_token: string };
        Returns: Array<{ space_id: string; inviter_name: string; partner_name: string; expires_at: string }>;
      };
      accept_couple_invitation: { Args: { p_token: string }; Returns: string };
      open_future_message: { Args: { p_id: string }; Returns: undefined };
      mark_letter_read: { Args: { p_id: string }; Returns: undefined };
      export_family: { Args: { p_family_id: string }; Returns: Json };
      delete_memory: { Args: { p_memory_id: string }; Returns: undefined };
      delete_family: { Args: { p_family_id: string; p_confirm_name: string }; Returns: undefined };
      leave_family: { Args: { p_family_id: string }; Returns: undefined };
      record_fact_claim: {
        Args: {
          p_family_id: string; p_subject_type: string; p_subject_id: string;
          p_field_key: string; p_value_text?: string | null; p_value_date?: string | null;
          p_source_id?: string | null; p_confidence?: ConfidenceLevel;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
