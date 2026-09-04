import { requireMySpace } from '@/lib/couple/guard';
import {
  listCoupleFirsts, listCoupleLetters, listCoupleMemories, listCouplePlaces,
  listVoiceMemories, signCoupleMedia,
} from '@/lib/data/couple-space';
import { groupByYear, type TimelineEntry } from '@/lib/couple/timeline';
import { firstLabel } from '@/lib/couple/firsts';
import { AppHeader } from '@/components/nav/AppHeader';
import { CoupleTimeline } from '@/components/couple/CoupleTimeline';

export const dynamic = 'force-dynamic';

/**
 * The relationship in order.
 *
 * Five tables merged in application code rather than a database view. A view
 * would have to union five shapes with five different privacy rules, and every
 * section added later would mean another migration; this is one function, and
 * the grouping it uses is unit-tested without a database.
 */
export default async function CoupleTimelinePage() {
  const mine = await requireMySpace();
  const spaceId = mine.space.id;

  const [memories, firsts, places, letters, voice] = await Promise.all([
    listCoupleMemories(spaceId),
    listCoupleFirsts(spaceId),
    listCouplePlaces(spaceId),
    listCoupleLetters(spaceId),
    listVoiceMemories(spaceId),
  ]);

  const covers = memories.flatMap((memory) => memory.media.slice(0, 1));
  const urls = await signCoupleMedia(covers);

  const entries: TimelineEntry[] = [
    ...memories
      .filter((memory) => memory.memory_date)
      .map((memory) => ({
        id: `memory:${memory.id}`,
        kind: 'memory' as const,
        title: memory.title,
        date: memory.memory_date as string,
        subtitle: memory.place_label,
        href: `/us/memories/${memory.id}`,
        imageUrl: memory.media[0] ? urls.get(memory.media[0].storage_path) ?? null : null,
      })),
    ...firsts
      .filter((first) => first.happened_on)
      .map((first) => ({
        id: `first:${first.id}`,
        kind: 'first' as const,
        title: firstLabel(first.key),
        date: first.happened_on as string,
        subtitle: null,
        href: '/us/firsts',
        imageUrl: null,
      })),
    ...places
      .filter((place) => place.visited_on)
      .map((place) => ({
        id: `place:${place.id}`,
        kind: 'place' as const,
        title: place.name,
        date: place.visited_on as string,
        subtitle: null,
        href: '/us/places',
        imageUrl: null,
      })),
    // A letter is on the timeline by the day it was written. A sealed one still
    // appears — that it exists is not the secret, only what it says is.
    ...letters.map((letter) => ({
      id: `letter:${letter.id}`,
      kind: 'letter' as const,
      title: letter.title,
      date: letter.created_at.slice(0, 10),
      subtitle: letter.unlock_at && new Date(letter.unlock_at) > new Date() ? 'Битүүмжилсэн' : null,
      href: `/us/letters/${letter.id}`,
      imageUrl: null,
    })),
    ...voice
      .filter((note) => note.recorded_on)
      .map((note) => ({
        id: `voice:${note.id}`,
        kind: 'voice' as const,
        title: note.title,
        date: note.recorded_on as string,
        subtitle: null,
        href: '/us/voice',
        imageUrl: null,
      })),
  ];

  return (
    <>
      <AppHeader title="Он цагийн хэлхээс" backHref="/us" />
      <main id="main" className="px-4 pb-10">
        <CoupleTimeline years={groupByYear(entries)} />
      </main>
    </>
  );
}
