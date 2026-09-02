import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { CoupleRow, MediaRow, MemoryRow, PersonRow } from '@/types/database';

export interface CoupleProfile {
  couple: CoupleRow;
  partners: PersonRow[];
  children: PersonRow[];
  grandchildren: PersonRow[];
  memories: MemoryRow[];
  media: MediaRow[];
  marriagePlace: { id: string; name: string } | null;
  places: Array<{ id: string; name: string }>;
}

/**
 * A couple's shared life.
 *
 * Couples are first-class in ROOTS, not a line on a person's page: a marriage
 * has its own dates, its own photographs, its own children and its own story,
 * and "Bat ❤ Saruul, married 1986, 3 children, 7 grandchildren" is a thing a
 * family wants to look at on its own terms.
 */
export async function getCoupleProfile(coupleId: string): Promise<CoupleProfile | null> {
  const supabase = await createClient();

  const { data: couple } = await supabase
    .from('couples')
    .select('*')
    .eq('id', coupleId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!couple) return null;

  const partnerIds = [couple.person_a_id, couple.person_b_id].filter(
    (id): id is string => typeof id === 'string',
  );

  const [partners, childLinks, memories, media, marriagePlace] = await Promise.all([
    supabase.from('people').select('*').in('id', partnerIds).is('deleted_at', null),
    supabase.from('parent_child_relationships').select('child_id').eq('couple_id', coupleId),
    supabase.from('memories').select('*').eq('couple_id', coupleId).is('deleted_at', null)
      .order('memory_date', { ascending: false, nullsFirst: false }),
    supabase.from('media').select('*').eq('couple_id', coupleId).is('deleted_at', null)
      .order('taken_at', { ascending: false, nullsFirst: false }),
    couple.marriage_place_id
      ? supabase.from('locations').select('id, name').eq('id', couple.marriage_place_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const childIds = [...new Set((childLinks.data ?? []).map((row) => row.child_id))];

  const children = childIds.length > 0
    ? (await supabase.from('people').select('*').in('id', childIds).is('deleted_at', null)
        .order('birth_date', { ascending: true, nullsFirst: false })).data ?? []
    : [];

  // Grandchildren, so the couple page can say "3 children, 7 grandchildren".
  const grandchildren = childIds.length > 0
    ? await loadChildrenOf(childIds)
    : [];

  // Places both partners lived, de-duplicated across the two of them.
  const places = partnerIds.length > 0
    ? (await supabase.from('person_locations')
        .select('location:locations(id, name)')
        .in('person_id', partnerIds)).data ?? []
    : [];

  const placeMap = new Map<string, { id: string; name: string }>();
  for (const row of places) {
    const location = (row as unknown as { location: { id: string; name: string } | null }).location;
    if (location) placeMap.set(location.id, location);
  }

  async function loadChildrenOf(parentIds: string[]): Promise<PersonRow[]> {
    const supabaseInner = await createClient();
    const { data: links } = await supabaseInner
      .from('parent_child_relationships')
      .select('child_id')
      .in('parent_id', parentIds);

    const ids = [...new Set((links ?? []).map((row) => row.child_id))];
    if (ids.length === 0) return [];

    const { data } = await supabaseInner
      .from('people')
      .select('*')
      .in('id', ids)
      .is('deleted_at', null)
      .order('birth_date', { ascending: true, nullsFirst: false });
    return data ?? [];
  }

  // Partners are listed in marriage-record order (person_a first).
  const orderedPartners = partnerIds
    .map((id) => (partners.data ?? []).find((person) => person.id === id))
    .filter((person): person is PersonRow => person !== undefined);

  return {
    couple,
    partners: orderedPartners,
    children,
    grandchildren,
    memories: memories.data ?? [],
    media: media.data ?? [],
    marriagePlace: (marriagePlace.data as { id: string; name: string } | null) ?? null,
    places: [...placeMap.values()],
  };
}
