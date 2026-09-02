import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertFamilyAccess } from '@/lib/auth/guards';
import { getActiveFamily } from '@/lib/family-context';
import { getProfile } from '@/lib/auth/session';
import { getAIService } from '@/lib/ai';
import { recordAiOutput } from '@/lib/ai/record';
import { handle, ok, parseBody } from '@/lib/api';
import { formatDate } from '@/lib/format';

const bodySchema = z.object({ familyId: z.string().uuid().optional() });

/**
 * Generate the family's narrative history.
 *
 * Facts and memories are gathered SEPARATELY and passed to the model in two
 * labelled lists, because the output must let a reader tell "this is recorded"
 * from "this is what your aunt remembers". A story that blends them would be a
 * pleasant read and a corrupted archive.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);
    const active = await getActiveFamily();
    const membership = await assertFamilyAccess(body.familyId ?? active?.family_id, 'viewer');
    const familyId = membership.family_id;

    const supabase = await createClient();
    const locale = membership.family.default_locale;

    const [people, events, memories] = await Promise.all([
      supabase.from('people')
        .select('id, first_name, last_name, birth_date, death_date, generation, occupation, birth_place_id')
        .eq('family_id', familyId).is('deleted_at', null)
        .order('generation', { ascending: true })
        .order('birth_date', { ascending: true, nullsFirst: false }),
      supabase.from('life_events')
        .select('id, title, event_date, date_precision, event_type, person:people(first_name)')
        .eq('family_id', familyId).is('deleted_at', null)
        // Unconfirmed AI extractions are not facts and must not seed a story.
        .or('is_ai_extracted.eq.false,confirmed_at.not.is.null')
        .order('event_date', { ascending: true, nullsFirst: false })
        .limit(200),
      supabase.from('memories')
        .select('id, title, body, description, memory_date, contributor_name')
        .eq('family_id', familyId).is('deleted_at', null).eq('is_private', false)
        .order('memory_date', { ascending: true, nullsFirst: false })
        .limit(60),
    ]);

    const facts: string[] = [];
    for (const person of people.data ?? []) {
      const parts = [`${person.first_name}${person.last_name ? ` (${person.last_name})` : ''}`];
      if (person.generation) parts.push(`${person.generation}-р үе`);
      if (person.birth_date) parts.push(`төрсөн ${formatDate(person.birth_date, 'year', locale)}`);
      if (person.death_date) parts.push(`нас барсан ${formatDate(person.death_date, 'year', locale)}`);
      if (person.occupation) parts.push(person.occupation);
      facts.push(parts.join(', '));
    }
    for (const event of events.data ?? []) {
      const who = (event as unknown as { person: { first_name: string } | null }).person;
      facts.push(
        `${event.event_date ? formatDate(event.event_date, event.date_precision, locale) : 'огноо тодорхойгүй'} — ` +
        `${who ? `${who.first_name}: ` : ''}${event.title}`,
      );
    }

    const memoryList = (memories.data ?? []).map((memory) => ({
      text: [memory.title, memory.body ?? memory.description ?? ''].filter(Boolean).join(' — ').slice(0, 600),
      contributor: memory.contributor_name,
      date: memory.memory_date,
    }));

    const ai = getAIService();
    const result = await ai.generateFamilyStory({
      familyName: membership.family.name,
      facts,
      memories: memoryList,
      language: locale,
      grounding: [
        ...(people.data ?? []).map((person) => ({ type: 'person' as const, id: person.id })),
        ...(memories.data ?? []).map((memory) => ({ type: 'memory' as const, id: memory.id })),
      ],
    });

    const profile = await getProfile();
    await recordAiOutput({
      familyId,
      task: 'generate_story',
      provenance: result.provenance,
      subjectType: 'family',
      subjectId: familyId,
      inputSummary: `${facts.length} facts, ${memoryList.length} memories`,
      outputText: result.ok ? result.story : result.reason,
      userId: profile?.id ?? null,
    });

    if (!result.ok) {
      return ok({ unavailable: true, reason: result.reason, isMock: result.provenance.isMock });
    }

    return ok({
      story: result.story,
      memoryDerivedSections: result.memoryDerivedSections,
      isMock: result.provenance.isMock,
      basedOn: { facts: facts.length, memories: memoryList.length },
    });
  });
}
