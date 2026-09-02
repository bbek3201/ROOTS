import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  AppearanceDescriptionRow,
  CoupleRow,
  MediaRow,
  MemoryRow,
  PersonRow,
  PersonTimelineRow,
} from '@/types/database';

/** Everything a person profile page renders, loaded in one pass. */
export interface PersonProfile {
  person: PersonRow;
  birthPlace: { id: string; name: string } | null;
  couples: CoupleRow[];
  timeline: PersonTimelineRow[];
  memories: MemoryRow[];
  photos: MediaRow[];
  audio: MediaRow[];
  appearance: AppearanceDescriptionRow[];
  places: Array<{ id: string; kind: string; from_date: string | null; to_date: string | null; location: { id: string; name: string } | null }>;
}

export const getPerson = cache(async (personId: string): Promise<PersonRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('people')
    .select('*')
    .eq('id', personId)
    .is('deleted_at', null)
    .maybeSingle();
  return data ?? null;
});

export async function getPersonProfile(personId: string): Promise<PersonProfile | null> {
  const supabase = await createClient();

  const person = await getPerson(personId);
  // RLS already returned nothing for another family's person, so a null here is
  // indistinguishable from "does not exist" — which is exactly what we want.
  if (!person) return null;

  const [couples, timeline, memoryLinks, photos, audio, appearance, places, birthPlace] = await Promise.all([
    supabase.from('couples').select('*')
      .or(`person_a_id.eq.${personId},person_b_id.eq.${personId}`)
      .is('deleted_at', null)
      .order('marriage_date', { ascending: true, nullsFirst: false }),
    supabase.from('person_timeline').select('*')
      .eq('person_id', personId)
      .order('event_date', { ascending: true, nullsFirst: false }),
    supabase.from('memory_people').select('memory:memories!inner(*)')
      .eq('person_id', personId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('media').select('*')
      .eq('kind', 'photo').eq('person_id', personId).is('deleted_at', null)
      .order('taken_at', { ascending: false, nullsFirst: false }),
    supabase.from('media').select('*, audio:audio_recordings!inner(speaker_person_id)')
      .eq('kind', 'audio').is('deleted_at', null)
      .eq('audio_recordings.speaker_person_id', personId)
      .order('created_at', { ascending: false }),
    supabase.from('appearance_descriptions').select('*')
      .eq('person_id', personId)
      .order('created_at', { ascending: false }),
    supabase.from('person_locations').select('id, kind, from_date, to_date, location:locations(id, name)')
      .eq('person_id', personId)
      .order('from_date', { ascending: true, nullsFirst: false }),
    person.birth_place_id
      ? supabase.from('locations').select('id, name').eq('id', person.birth_place_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const memories = (memoryLinks.data ?? [])
    .map((row) => (row as unknown as { memory: MemoryRow }).memory)
    .filter((memory): memory is MemoryRow => Boolean(memory) && memory.deleted_at === null);

  return {
    person,
    birthPlace: (birthPlace.data as { id: string; name: string } | null) ?? null,
    couples: couples.data ?? [],
    timeline: timeline.data ?? [],
    memories,
    photos: photos.data ?? [],
    audio: (audio.data as MediaRow[] | null) ?? [],
    appearance: appearance.data ?? [],
    places: (places.data as PersonProfile['places'] | null) ?? [],
  };
}

/** Every photo that should appear on this person's wall, however it got there. */
export async function getPersonPhotoWall(personId: string): Promise<MediaRow[]> {
  const supabase = await createClient();
  const { data: wall } = await supabase
    .from('person_photos')
    .select('media_id')
    .eq('person_id', personId);

  const ids = [...new Set((wall ?? []).map((row) => row.media_id))];
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from('media')
    .select('*')
    .in('id', ids)
    .is('deleted_at', null)
    // Originals first: the scan of the 1978 print outranks any derivative of it.
    .order('variant', { ascending: true })
    .order('taken_at', { ascending: false, nullsFirst: false });

  return data ?? [];
}
