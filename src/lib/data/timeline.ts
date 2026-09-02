import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { PersonTimelineRow, TimelineEventRow } from '@/types/database';

/**
 * Timelines.
 *
 * Three scopes, one shape:
 *   · a person's own life
 *   · a couple's shared life
 *   · the family across generations
 * Each returns entries sorted by date, with undated entries collected at the
 * end rather than dropped — "we don't know the year" is common in an archive
 * and must never cause a memory to disappear.
 */

export interface TimelineEntry {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  date: string | null;
  datePrecision: string;
  isUnconfirmedAi: boolean;
  href?: string;
}

function sortEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const dated = entries.filter((entry) => entry.date !== null);
  const undated = entries.filter((entry) => entry.date === null);
  dated.sort((a, b) => (a.date as string).localeCompare(b.date as string));
  return [...dated, ...undated];
}

export async function getPersonTimeline(personId: string): Promise<TimelineEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('person_timeline')
    .select('*')
    .eq('person_id', personId);

  return sortEntries((data ?? []).map(toEntry));
}

export async function getCoupleTimeline(coupleId: string): Promise<TimelineEntry[]> {
  const supabase = await createClient();
  const [events, memories] = await Promise.all([
    supabase.from('life_events').select('*').eq('couple_id', coupleId).is('deleted_at', null),
    supabase.from('memories').select('*').eq('couple_id', coupleId).is('deleted_at', null),
  ]);

  const entries: TimelineEntry[] = [
    ...(events.data ?? []).map((row) => ({
      id: `life:${row.id}`,
      kind: row.event_type,
      title: row.title,
      description: row.description,
      date: row.event_date,
      datePrecision: row.date_precision,
      isUnconfirmedAi: row.is_ai_extracted && row.confirmed_at === null,
    })),
    ...(memories.data ?? []).map((row) => ({
      id: `memory:${row.id}`,
      kind: 'memory',
      title: row.title,
      description: row.description,
      date: row.memory_date,
      datePrecision: row.date_precision,
      isUnconfirmedAi: false,
      href: `/memories/${row.id}`,
    })),
  ];

  return sortEntries(entries);
}

export async function getFamilyTimeline(familyId: string, limit = 120): Promise<TimelineEntry[]> {
  const supabase = await createClient();

  const [familyEvents, lifeEvents] = await Promise.all([
    supabase.from('timeline_events').select('*').eq('family_id', familyId).is('deleted_at', null).limit(limit),
    supabase.from('life_events').select('*, person:people(id, first_name, last_name)')
      .eq('family_id', familyId).is('deleted_at', null)
      // Only milestones reach the family view; every birthday would drown it.
      .in('event_type', ['birth', 'death', 'marriage', 'migration', 'move'])
      .order('event_date', { ascending: true, nullsFirst: false })
      .limit(limit),
  ]);

  const entries: TimelineEntry[] = [
    ...((familyEvents.data ?? []) as TimelineEventRow[]).map((row) => ({
      id: `family:${row.id}`,
      kind: row.scope,
      title: row.title,
      description: row.description,
      date: row.event_date,
      datePrecision: row.date_precision,
      isUnconfirmedAi: false,
    })),
    ...(lifeEvents.data ?? []).map((row) => {
      const person = (row as unknown as { person: { id: string; first_name: string } | null }).person;
      return {
        id: `life:${row.id}`,
        kind: row.event_type,
        title: person ? `${person.first_name} — ${row.title}` : row.title,
        description: row.description,
        date: row.event_date,
        datePrecision: row.date_precision,
        isUnconfirmedAi: row.is_ai_extracted && row.confirmed_at === null,
        ...(person ? { href: `/person/${person.id}` } : {}),
      };
    }),
  ];

  return sortEntries(entries).slice(0, limit);
}

function toEntry(row: PersonTimelineRow): TimelineEntry {
  return {
    id: `${row.entry_kind}:${row.entry_id}`,
    kind: row.entry_kind === 'memory' ? 'memory' : row.event_type,
    title: row.title,
    description: row.description,
    date: row.event_date,
    datePrecision: row.date_precision,
    isUnconfirmedAi: row.is_ai_extracted && row.confirmed_at === null,
    ...(row.entry_kind === 'memory' ? { href: `/memories/${row.entry_id}` } : {}),
  };
}
