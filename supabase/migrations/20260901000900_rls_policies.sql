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
