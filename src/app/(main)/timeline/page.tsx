import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { getFamilyGraph } from '@/lib/data/family';
import { listMemories } from '@/lib/data/memories';
import { getFamilyTimeline } from '@/lib/data/timeline';
import { getSignedUrls } from '@/lib/media/storage';
import { FamilyChronicle, type ChronicleEntry } from '@/components/timeline/FamilyChronicle';
import { displayName, yearOf } from '@/lib/format';
import type { MemoryRow } from '@/types/database';

export const dynamic = 'force-dynamic';

/**
 * The family timeline.
 *
 * Assembled from the graph itself rather than from an events table alone: a
 * marriage, a birth and a death are already recorded as structure, and asking a
 * family to re-enter them as "events" before their chronology works would be
 * asking them to keep the same facts twice. Recorded family events and dated
 * memories are merged on top, and the archive's own life events for births,
 * deaths and marriages are dropped so nothing appears on the page twice.
 */
export default async function TimelinePage() {
  const membership = await requireActiveFamily();
  const familyId = membership.family_id;

  const [graph, events, memoryList] = await Promise.all([
    getFamilyGraph(familyId),
    getFamilyTimeline(familyId),
    listMemories(familyId, { limit: 60 }),
  ]);

  const people = new Map(graph.people.map((person) => [person.id, person]));
  const entries: ChronicleEntry[] = [];

  // ---- what the graph already knows -------------------------------------
  for (const couple of graph.couples) {
    const year = yearOf(couple.marriage_date ?? couple.relationship_start);
    if (!year) continue;
    const a = people.get(couple.person_a_id);
    const b = couple.person_b_id ? people.get(couple.person_b_id) : null;
    if (!a) continue;
    entries.push({
      id: `couple:${couple.id}`,
      year,
      kind: 'marriage',
      title: b ? `${displayName(a)} ба ${displayName(b)} гэр бүл болов` : `${displayName(a)}-н гэр бүл`,
      description: null,
      href: `/couple/${couple.id}`,
    });
  }

  for (const person of graph.people) {
    const born = yearOf(person.birth_date);
    if (born) {
      entries.push({
        id: `birth:${person.id}`,
        year: born,
        kind: 'birth',
        title: `${displayName(person)} мэндэлсэн`,
        description: person.occupation,
        href: `/person/${person.id}`,
      });
    }
    const died = yearOf(person.death_date);
    if (died) {
      entries.push({
        id: `death:${person.id}`,
        year: died,
        kind: 'death',
        title: `${displayName(person)} тэнгэрт халив`,
        description: null,
        href: `/person/${person.id}`,
      });
    }
  }

  // ---- recorded family events, minus what the graph already said ---------
  for (const event of events) {
    if (['birth', 'death', 'marriage'].includes(event.kind)) continue;
    entries.push({
      id: event.id,
      year: yearOf(event.date),
      kind: event.kind,
      title: event.title,
      description: event.description,
      ...(event.href ? { href: event.href } : {}),
    });
  }

  // ---- memories, with their photographs ----------------------------------
  const memories = memoryList.memories as unknown as Array<
    MemoryRow & { media?: Array<{ kind: string; variant: string; storage_path: string }> }
  >;

  const coverPaths = new Map<string, string>();
  for (const memory of memories) {
    const cover = (memory.media ?? []).find(
      (item) => item.kind === 'photo' && item.variant === 'original',
    );
    if (cover) coverPaths.set(memory.id, cover.storage_path);
  }
  const signed = await getSignedUrls([...coverPaths.values()]);

  for (const memory of memories) {
    const path = coverPaths.get(memory.id);
    const src = path ? signed.get(path) : null;
    entries.push({
      id: `memory:${memory.id}`,
      year: yearOf(memory.memory_date),
      kind: 'memory',
      title: memory.title,
      description: memory.description,
      href: `/memories/${memory.id}`,
      photo: src ? { src, alt: memory.title } : null,
    });
  }

  // Oldest first — a chronology is read forwards. Undated entries keep their
  // place at the end rather than being dropped from the family's history.
  const sorted = [...entries].sort((a, b) => {
    if (!a.year) return 1;
    if (!b.year) return -1;
    return a.year.localeCompare(b.year);
  });

  const first = sorted.find((entry) => entry.year)?.year;
  const last = [...sorted].reverse().find((entry) => entry.year)?.year;

  return (
    <main id="main">
      <header className="rt-gutters pt-16 pb-14 lg:pt-24 lg:pb-20">
        <p className="ed-eyebrow">Timeline</p>
        <h1 className="ed-display ed-display-xl mt-7 max-w-[16ch]">
          Танай гэр бүлийн он цагийн хэлхээ.
        </h1>
        <p className="ed-lead mt-8">
          {first && last
            ? `${first} оноос ${last} он хүртэл — гэрлэлт, төрөлт, нүүдэл, дурсамжууд нэг мөрөнд.`
            : 'Огноо бүхий дурсамж, гэрлэлт, төрөлт нэмэгдэх тусам энэ хэлхээ уртсана.'}
        </p>
      </header>

      {sorted.length > 0 ? (
        <FamilyChronicle entries={sorted} />
      ) : (
        <section className="rt-gutters pb-24">
          <div className="ed-band-sage rounded-[32px] px-8 py-16 text-center sm:px-16 sm:py-24">
            <h2 className="ed-display ed-display-lg">Хэлхээ хоосон байна.</h2>
            <p className="ed-lead mx-auto mt-6">
              Хүн, хос, дурсамж нэмэхэд он цагийн хэлхээ өөрөө бүрдэж эхэлнэ.
            </p>
            <Link href="/family/add-person" className="ed-btn ed-btn-primary mt-10">
              Эхний хүнийг нэмэх
            </Link>
          </div>
        </section>
      )}

      <footer className="rt-gutters ed-hair py-12">
        <p className="ed-eyebrow">Roots · {membership.family.name}</p>
      </footer>
    </main>
  );
}
