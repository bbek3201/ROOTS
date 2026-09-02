import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { MediaRow, MemoryRow, MemoryType, PersonRow } from '@/types/database';

/** A memory with everyone and everything attached to it. */
export interface MemoryDetail {
  memory: MemoryRow;
  people: Array<Pick<PersonRow, 'id' | 'first_name' | 'last_name' | 'nickname' | 'profile_photo_media_id'> & { role: string }>;
  media: MediaRow[];
  location: { id: string; name: string } | null;
}

export interface MemoryFilters {
  type?: MemoryType;
  personId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listMemories(familyId: string, filters: MemoryFilters = {}) {
  const supabase = await createClient();
  const limit = Math.min(filters.limit ?? 24, 100);

  let query = supabase
    .from('memories')
    .select('*, media(id, kind, variant, storage_path, storage_bucket)', { count: 'exact' })
    .eq('family_id', familyId)
    .is('deleted_at', null);

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.search) {
    // Escape the PostgREST filter separators so a comma or parenthesis in the
    // query cannot break out of the `or()` expression.
    const safe = filters.search.replace(/[(),]/g, ' ').trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,body.ilike.%${safe}%`);
  }

  if (filters.personId) {
    const { data: links } = await supabase
      .from('memory_people')
      .select('memory_id')
      .eq('person_id', filters.personId);
    const ids = (links ?? []).map((row) => row.memory_id);
    if (ids.length === 0) return { memories: [], count: 0 };
    query = query.in('id', ids);
  }

  const { data, count } = await query
    .order('memory_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + limit - 1);

  return { memories: data ?? [], count: count ?? 0 };
}

export async function getMemory(memoryId: string): Promise<MemoryDetail | null> {
  const supabase = await createClient();

  const { data: memory } = await supabase
    .from('memories')
    .select('*')
    .eq('id', memoryId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!memory) return null;

  const [people, media, location] = await Promise.all([
    supabase.from('memory_people')
      .select('role, person:people(id, first_name, last_name, nickname, profile_photo_media_id)')
      .eq('memory_id', memoryId),
    supabase.from('media').select('*').eq('memory_id', memoryId).is('deleted_at', null)
      .order('variant', { ascending: true }),
    memory.location_id
      ? supabase.from('locations').select('id, name').eq('id', memory.location_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    memory,
    people: (people.data ?? []).flatMap((row) => {
      const person = (row as unknown as { person: PersonRow | null }).person;
      return person ? [{ ...person, role: row.role }] : [];
    }),
    media: media.data ?? [],
    location: (location.data as { id: string; name: string } | null) ?? null,
  };
}
