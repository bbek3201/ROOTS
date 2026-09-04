import 'server-only';

import { createClient } from '@/lib/supabase/server';

// The roster the picker offers is a pure function of the family graph, so it
// lives outside this server-only module and is unit-tested without a database.
export { taggablePeople, type TaggablePerson } from '@/lib/media/taggable';

export interface PhotoTag {
  personId: string;
  name: string;
  /** An AI guess that nobody has looked at yet is shown, but marked as a guess. */
  suggested: boolean;
  confirmed: boolean;
}

/**
 * Who is in each of these photographs.
 *
 * One query for a whole wall rather than one per photo: a person's page opens
 * with thirty images, and thirty round trips to name the faces in them is the
 * difference between a page that appears and a page that assembles itself.
 *
 * Unconfirmed AI suggestions come back too. They are never presented as fact —
 * the caller marks them — but hiding them would leave a relative no way to say
 * yes, and an unanswered guess is the whole point of the confirm step.
 */
export async function getPhotoTags(mediaIds: string[]): Promise<Map<string, PhotoTag[]>> {
  const byMedia = new Map<string, PhotoTag[]>();
  if (mediaIds.length === 0) return byMedia;

  const supabase = await createClient();
  const { data } = await supabase
    .from('photo_people_tags')
    .select('media_id, person_id, suggested_by_ai, confirmed_at, person:people(first_name, last_name, nickname)')
    .in('media_id', mediaIds);

  for (const row of (data ?? []) as unknown as TagJoin[]) {
    const person = row.person;
    if (!person) continue;
    const list = byMedia.get(row.media_id) ?? [];
    list.push({
      personId: row.person_id,
      name: person.nickname || [person.first_name, person.last_name].filter(Boolean).join(' '),
      suggested: row.suggested_by_ai,
      confirmed: row.confirmed_at !== null,
    });
    byMedia.set(row.media_id, list);
  }

  return byMedia;
}

interface TagJoin {
  media_id: string;
  person_id: string;
  suggested_by_ai: boolean;
  confirmed_at: string | null;
  person: { first_name: string; last_name: string | null; nickname: string | null } | null;
}
