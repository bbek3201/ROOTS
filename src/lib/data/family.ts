import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { buildFamilyIndex, type FamilyIndex } from '@/lib/relationships/graph';
import type { FamilyGraph } from '@/lib/relationships/types';
import type { MemoryRow, InterviewRow, TimelineEventRow } from '@/types/database';

/**
 * Family-level reads.
 *
 * All of these run as the signed-in user, so RLS is the access control. There
 * is no `family_id = ?` filter written by hand anywhere that could be forgotten
 * — the policies apply it whether or not the query asks.
 */

export const getFamilyGraph = cache(async (familyId: string): Promise<FamilyGraph> => {
  const supabase = await createClient();
  // One RPC instead of three round trips: the tree needs all of it at once.
  const { data, error } = await supabase.rpc('get_family_graph', { p_family_id: familyId });
  if (error) throw new Error(error.message);

  const graph = data as unknown as FamilyGraph | null;
  return graph ?? { family_id: familyId, people: [], couples: [], parent_child: [] };
});

export const getFamilyIndex = cache(async (familyId: string): Promise<FamilyIndex> => {
  return buildFamilyIndex(await getFamilyGraph(familyId));
});

/** A memory with just enough of its media attached to show a cover. */
export type MemoryWithCover = MemoryRow & {
  media?: Array<{ id: string; kind: string; variant: string; storage_path: string }>;
};

export interface FamilyHomeData {
  recentMemories: MemoryWithCover[];
  resumableInterview: InterviewRow | null;
  upcomingTimeline: TimelineEventRow[];
  counts: { people: number; couples: number; memories: number; media: number };
}

/** Everything the home screen shows, gathered in parallel. */
export async function getFamilyHome(familyId: string): Promise<FamilyHomeData> {
  const supabase = await createClient();

  const [memories, interview, timeline, peopleCount, coupleCount, memoryCount, mediaCount] = await Promise.all([
    // The home screen leads with photographs, so covers come back with the
    // memories rather than in a second pass per card.
    supabase
      .from('memories')
      .select('*, media(id, kind, variant, storage_path)')
      .eq('family_id', familyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('interviews')
      .select('*')
      .eq('family_id', familyId)
      .in('status', ['in_progress', 'paused'])
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('timeline_events')
      .select('*')
      .eq('family_id', familyId)
      .is('deleted_at', null)
      .order('event_date', { ascending: false, nullsFirst: false })
      .limit(5),
    supabase.from('people').select('id', { count: 'exact', head: true }).eq('family_id', familyId).is('deleted_at', null),
    supabase.from('couples').select('id', { count: 'exact', head: true }).eq('family_id', familyId).is('deleted_at', null),
    supabase.from('memories').select('id', { count: 'exact', head: true }).eq('family_id', familyId).is('deleted_at', null),
    supabase.from('media').select('id', { count: 'exact', head: true }).eq('family_id', familyId).is('deleted_at', null),
  ]);

  return {
    recentMemories: (memories.data ?? []) as unknown as MemoryWithCover[],
    resumableInterview: interview.data ?? null,
    upcomingTimeline: timeline.data ?? [],
    counts: {
      people: peopleCount.count ?? 0,
      couples: coupleCount.count ?? 0,
      memories: memoryCount.count ?? 0,
      media: mediaCount.count ?? 0,
    },
  };
}

export interface ActivityEntry {
  id: string;
  action: string;
  resource_type: string | null;
  created_at: string;
  actor_name: string | null;
}

/**
 * Recent family activity, assembled from the content itself rather than the
 * audit log — the audit log is an admin-only security record, while this is the
 * warm "your cousin added three photos" feed everyone should see.
 */
export async function getFamilyActivity(familyId: string, limit = 8): Promise<ActivityEntry[]> {
  const supabase = await createClient();

  const [memories, media, people] = await Promise.all([
    supabase.from('memories').select('id, title, contributor_name, created_at')
      .eq('family_id', familyId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(limit),
    supabase.from('media').select('id, kind, uploaded_by_name, created_at')
      .eq('family_id', familyId).is('deleted_at', null).eq('variant', 'original')
      .order('created_at', { ascending: false }).limit(limit),
    supabase.from('people').select('id, first_name, created_at')
      .eq('family_id', familyId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(limit),
  ]);

  const entries: ActivityEntry[] = [
    ...(memories.data ?? []).map((row) => ({
      id: `memory:${row.id}`,
      action: `«${row.title}» дурсамж нэмэгдлээ`,
      resource_type: 'memory',
      created_at: row.created_at,
      actor_name: row.contributor_name,
    })),
    ...(media.data ?? []).map((row) => ({
      id: `media:${row.id}`,
      action: mediaActionLabel(row.kind),
      resource_type: 'media',
      created_at: row.created_at,
      actor_name: row.uploaded_by_name,
    })),
    ...(people.data ?? []).map((row) => ({
      id: `person:${row.id}`,
      action: `${row.first_name} гэр бүлийн модонд нэмэгдлээ`,
      resource_type: 'person',
      created_at: row.created_at,
      actor_name: null,
    })),
  ];

  return entries
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

function mediaActionLabel(kind: string): string {
  switch (kind) {
    case 'photo': return 'Хуучин зураг архивт нэмэгдлээ';
    case 'audio': return 'Дуу хоолойн бичлэг хадгалагдлаа';
    case 'video': return 'Видео бичлэг нэмэгдлээ';
    default: return 'Баримт архивт нэмэгдлээ';
  }
}

/**
 * Storage paths for a set of media ids.
 *
 * The tree graph carries `profile_photo_media_id` but no path, because the
 * graph is loaded by an RPC that must stay cheap enough to call while panning.
 * Screens that actually show faces resolve the paths here, in one query.
 */
export async function getMediaPaths(mediaIds: Array<string | null | undefined>): Promise<Map<string, string>> {
  const ids = [...new Set(mediaIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase.from('media').select('id, storage_path').in('id', ids);
  return new Map((data ?? []).map((row) => [row.id, row.storage_path]));
}
