import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getSignedUrls } from '@/lib/media/storage';
import type {
  CoupleFirstRow, CoupleFutureMessageRow, CoupleLetterRow, CoupleMediaRow,
  CoupleMemoryRow, CouplePlaceRow, CoupleVoiceMemoryRow,
} from '@/types/database';

/**
 * Reads inside one couple space.
 *
 * Every function here takes a spaceId that the caller has already resolved
 * through requireCoupleSpace, and every query still runs under RLS — so a
 * spaceId smuggled in from elsewhere returns nothing rather than somebody
 * else's letters. The guard and the policy are both load-bearing; neither is
 * there because the other might be forgotten.
 */

export type CoupleMemoryWithMedia = CoupleMemoryRow & { media: CoupleMediaRow[] };

export async function listCoupleMemories(spaceId: string): Promise<CoupleMemoryWithMedia[]> {
  const supabase = await createClient();

  const { data: memories } = await supabase
    .from('couple_memories')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('memory_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (!memories || memories.length === 0) return [];

  const { data: links } = await supabase
    .from('couple_memory_media')
    .select('memory_id, position, media:couple_media(*)')
    .in('memory_id', memories.map((memory) => memory.id))
    .order('position', { ascending: true });

  const byMemory = new Map<string, CoupleMediaRow[]>();
  for (const link of (links ?? []) as unknown as Array<{ memory_id: string; media: CoupleMediaRow | null }>) {
    if (!link.media || link.media.deleted_at) continue;
    const list = byMemory.get(link.memory_id) ?? [];
    list.push(link.media);
    byMemory.set(link.memory_id, list);
  }

  return memories.map((memory) => ({ ...memory, media: byMemory.get(memory.id) ?? [] }));
}

export async function getCoupleMemory(memoryId: string): Promise<CoupleMemoryWithMedia | null> {
  const supabase = await createClient();

  const { data: memory } = await supabase
    .from('couple_memories').select('*').eq('id', memoryId).is('deleted_at', null).maybeSingle();
  if (!memory) return null;

  const { data: links } = await supabase
    .from('couple_memory_media')
    .select('position, media:couple_media(*)')
    .eq('memory_id', memoryId)
    .order('position', { ascending: true });

  const media = ((links ?? []) as unknown as Array<{ media: CoupleMediaRow | null }>)
    .map((link) => link.media)
    .filter((item): item is CoupleMediaRow => item !== null && item.deleted_at === null);

  return { ...memory, media };
}

/**
 * Letters, with their bodies where the seal allows.
 *
 * The body comes from its own table, and a row that comes back at all is a row
 * the database has decided may be read. There is no unlock check written here,
 * on purpose: a check in application code is a check that can be skipped by the
 * next caller, and this one cannot be.
 */
export async function listCoupleLetters(spaceId: string): Promise<Array<
  CoupleLetterRow & { body: string | null }
>> {
  const supabase = await createClient();

  const { data: letters } = await supabase
    .from('couple_letters')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (!letters || letters.length === 0) return [];

  const { data: bodies } = await supabase
    .from('couple_letter_bodies')
    .select('letter_id, body')
    .in('letter_id', letters.map((letter) => letter.id));

  const byLetter = new Map((bodies ?? []).map((row) => [row.letter_id, row.body]));
  return letters.map((letter) => ({ ...letter, body: byLetter.get(letter.id) ?? null }));
}

export async function getCoupleLetter(letterId: string): Promise<(CoupleLetterRow & { body: string | null }) | null> {
  const supabase = await createClient();

  const { data: letter } = await supabase
    .from('couple_letters').select('*').eq('id', letterId).is('deleted_at', null).maybeSingle();
  if (!letter) return null;

  const { data: body } = await supabase
    .from('couple_letter_bodies').select('body').eq('letter_id', letterId).maybeSingle();

  return { ...letter, body: body?.body ?? null };
}

/**
 * Future messages. A locked one comes back with its title and its date and
 * nothing else — the body is simply not in the database's answer.
 */
export async function listFutureMessages(spaceId: string): Promise<Array<
  CoupleFutureMessageRow & { body: string | null }
>> {
  const supabase = await createClient();

  const { data: messages } = await supabase
    .from('couple_future_messages')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('unlock_at', { ascending: true });

  if (!messages || messages.length === 0) return [];

  const { data: bodies } = await supabase
    .from('couple_future_message_bodies')
    .select('message_id, body')
    .in('message_id', messages.map((message) => message.id));

  const byMessage = new Map((bodies ?? []).map((row) => [row.message_id, row.body]));
  return messages.map((message) => ({ ...message, body: byMessage.get(message.id) ?? null }));
}

export async function listCouplePlaces(spaceId: string): Promise<CouplePlaceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('couple_places')
    .select('*')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('visited_on', { ascending: false, nullsFirst: false });
  return data ?? [];
}

export async function listCoupleFirsts(spaceId: string): Promise<CoupleFirstRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('couple_firsts').select('*').eq('space_id', spaceId);
  return data ?? [];
}

export type VoiceMemoryWithMedia = CoupleVoiceMemoryRow & { media: CoupleMediaRow | null };

export async function listVoiceMemories(spaceId: string): Promise<VoiceMemoryWithMedia[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('couple_voice_memories')
    .select('*, media:couple_media(*)')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('recorded_on', { ascending: false, nullsFirst: false });
  return (data as unknown as VoiceMemoryWithMedia[] | null) ?? [];
}

/** What the dashboard counts. One round trip, no rows. */
export async function coupleCounts(spaceId: string): Promise<{
  memories: number; letters: number; places: number; voice: number; future: number;
}> {
  const supabase = await createClient();
  const count = (table: 'couple_memories' | 'couple_letters' | 'couple_places'
                        | 'couple_voice_memories' | 'couple_future_messages') =>
    supabase.from(table).select('id', { count: 'exact', head: true }).eq('space_id', spaceId);

  const [memories, letters, places, voice, future] = await Promise.all([
    count('couple_memories'), count('couple_letters'), count('couple_places'),
    count('couple_voice_memories'), count('couple_future_messages'),
  ]);

  return {
    memories: memories.count ?? 0,
    letters: letters.count ?? 0,
    places: places.count ?? 0,
    voice: voice.count ?? 0,
    future: future.count ?? 0,
  };
}

/**
 * Signed URLs for a set of couple files.
 *
 * Uses the same signer as the family archive, which matters: signing runs as
 * the caller, and Supabase applies the storage policy to signing as well as to
 * reading. A path from a couple space the caller is not in produces no URL,
 * even though the code asking for it looks identical.
 */
export async function signCoupleMedia(media: readonly { storage_path: string }[]): Promise<Map<string, string>> {
  return getSignedUrls(media.map((item) => item.storage_path));
}

/**
 * Signed URLs for a handful of attachments, addressed by id rather than path.
 *
 * Letters, places, firsts and future messages each carry at most one file, so
 * they store a media_id rather than joining a whole row. This resolves a page's
 * worth of those in one query and one signing round trip.
 */
export async function signMediaByIds(
  ids: ReadonlyArray<string | null>,
): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
  if (wanted.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from('couple_media')
    .select('id, storage_path')
    .in('id', wanted)
    .is('deleted_at', null);

  const rows = data ?? [];
  const urls = await getSignedUrls(rows.map((row) => row.storage_path));

  const byId = new Map<string, string>();
  for (const row of rows) {
    const url = urls.get(row.storage_path);
    if (url) byId.set(row.id, url);
  }
  return byId;
}
