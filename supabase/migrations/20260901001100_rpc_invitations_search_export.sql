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
  order by rank desc nulls last
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
