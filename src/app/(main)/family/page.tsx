import { requireActiveFamily } from '@/lib/family-context';
import { can } from '@/lib/auth/session';
import { getJoinCode } from '@/lib/data/join-code';
import { getFamilyGraph, getFamilyHome, getMediaPaths } from '@/lib/data/family';
import { listMemories } from '@/lib/data/memories';
import { listInterviews } from '@/lib/data/interviews';
import { buildFamilyIndex, type FamilyIndex } from '@/lib/relationships/graph';
import { getSignedUrls } from '@/lib/media/storage';
import { FamilyHome, type GalleryPerson, type HeroPlate } from '@/components/home/FamilyHome';
import type { LineageBand } from '@/components/home/Lineage';
import type { MosaicItem } from '@/components/home/Mosaic';
import type { VoiceEntry } from '@/components/home/Voices';
import { displayName, lifespan, yearOf } from '@/lib/format';
import type { FamilyGraph, PersonNode } from '@/lib/relationships/types';
import type { MemoryRow } from '@/types/database';

export const dynamic = 'force-dynamic';

/**
 * The family home — data only.
 *
 * Everything about how this page LOOKS lives in <FamilyHome>. What happens here
 * is the reverse: read the graph, the memories, the recordings, resolve the
 * signed URLs in one round trip, and hand down a finished view model. Splitting
 * it this way keeps the fetch fan-out (which must stay one wave of parallel
 * queries) away from the layout, and makes the cover renderable without a
 * session for design review.
 */
export default async function FamilyHomePage() {
  const membership = await requireActiveFamily();
  const familyId = membership.family_id;

  const [graph, home, memoryList, interviews, joinCode] = await Promise.all([
    getFamilyGraph(familyId),
    getFamilyHome(familyId),
    listMemories(familyId, { limit: 24 }),
    listInterviews(familyId),
    // Only an admin can be shown the code, and only an admin's page asks: the
    // RPC refuses anyone else, so asking for everyone would be a wasted call.
    can(membership, 'administer') ? getJoinCode(familyId) : Promise.resolve(null),
  ]);

  const index = buildFamilyIndex(graph);
  const generations = new Set(graph.people.map((person) => person.generation ?? 0)).size;

  // ---- Photographs -------------------------------------------------------
  const covers = (memoryList.memories as unknown as MemoryWithMedia[])
    .map((memory) => ({ memory, path: coverPath(memory) }))
    .filter((entry): entry is CoverEntry => entry.path !== null);

  const heroCovers = covers.slice(0, 3);
  const wallCovers = covers.slice(3, 13);
  // The closing photograph should not repeat the hero unless it has to.
  const closingCover = covers.length > 3 ? covers[covers.length - 1] : covers[0];

  // ---- People ------------------------------------------------------------
  const bandSource = buildBands(graph, index);
  const galleryPeople = [...graph.people]
    .sort(
      (a, b) =>
        // Faces before initials — the gallery is a portrait wall, and a screen
        // of monograms is not one.
        Number(Boolean(b.profile_photo_media_id)) - Number(Boolean(a.profile_photo_media_id)) ||
        (a.generation ?? 99) - (b.generation ?? 99),
    )
    .slice(0, 8);

  const personPaths = await getMediaPaths(
    [...bandSource.flatMap((band) => band.people), ...galleryPeople].map(
      (person) => person.profile_photo_media_id,
    ),
  );

  // The family's own cover photograph, if they have chosen one. It outranks
  // anything picked automatically: it is the picture the family says is them.
  const coverPaths = await getMediaPaths([membership.family.cover_media_id]);
  const familyCoverPath = membership.family.cover_media_id
    ? coverPaths.get(membership.family.cover_media_id) ?? null
    : null;

  // One signing round trip for every image on the page.
  const urls = await getSignedUrls([
    ...covers.map((entry) => entry.path),
    ...personPaths.values(),
    ...(familyCoverPath ? [familyCoverPath] : []),
  ]);

  const portraitOf = (person: PersonNode): string | null => {
    const path = person.profile_photo_media_id ? personPaths.get(person.profile_photo_media_id) : null;
    return path ? (urls.get(path) ?? null) : null;
  };

  const memoryPlates: HeroPlate[] = heroCovers.map((entry) => ({
    src: urls.get(entry.path) ?? null,
    alt: entry.memory.title,
    initial: entry.memory.title.slice(0, 1),
  }));

  const familyCover = familyCoverPath ? urls.get(familyCoverPath) ?? null : null;
  const hero: HeroPlate[] = familyCover
    ? [
        { src: familyCover, alt: membership.family.name, initial: membership.family.name.slice(0, 1) },
        ...memoryPlates,
      ].slice(0, 3)
    : memoryPlates;

  const bands: LineageBand[] = bandSource.map((band) => ({
    key: band.key,
    label: band.label,
    overflow: band.overflow,
    units: band.units.map((unit) => ({
      id: unit.id,
      href: unit.href,
      people: unit.people.map((person) => ({
        id: person.id,
        name: displayName(person),
        year: yearOf(person.birth_date),
        photoUrl: portraitOf(person),
        initial: displayName(person).slice(0, 1),
      })),
    })),
  }));

  const wall: MosaicItem[] = wallCovers.map(({ memory, path }) => ({
    id: memory.id,
    href: `/memories/${memory.id}`,
    src: urls.get(path) ?? null,
    title: memory.title,
    meta: memory.memory_date ? yearOf(memory.memory_date) : memory.contributor_name,
  }));

  const gallery: GalleryPerson[] = galleryPeople.map((person) => ({
    id: person.id,
    href: `/person/${person.id}`,
    name: displayName(person),
    meta:
      [person.occupation, lifespan(person)].filter(Boolean).join(' · ') ||
      `${person.generation ?? 1}-р үе`,
    src: portraitOf(person),
  }));

  const voices: VoiceEntry[] = interviews
    .filter((interview) => interview.subject)
    .slice(0, 4)
    .map((interview) => ({
      id: interview.id,
      href: `/interview/${interview.id}`,
      subject: displayName(interview.subject),
      title: interview.title ?? 'Амьдралын түүх',
      meta: interview.total > 0 ? `${interview.answered}/${interview.total} асуулт` : 'Эхлээгүй',
    }));

  return (
    <FamilyHome
      familyName={membership.family.name}
      isEmpty={graph.people.length === 0}
      joinCode={joinCode && joinCode.isEnabled ? joinCode.code : null}
      generations={generations}
      stats={{
        people: graph.people.length,
        memories: home.counts.memories,
        media: home.counts.media,
      }}
      hero={hero}
      heroCaption={
        // The caption names the photograph behind the headline. When that is
        // the family's own cover it needs no caption — the name is already
        // over it — so this only speaks for an automatically chosen memory.
        familyCover
          ? null
          : heroCovers[0]?.memory.memory_date
            ? `${yearOf(heroCovers[0].memory.memory_date)} · ${heroCovers[0].memory.title}`
            : null
      }
      bands={bands}
      wall={wall}
      gallery={gallery}
      voices={voices}
      interview={{
        href: home.resumableInterview ? `/interview/${home.resumableInterview.id}` : '/interview',
        label: home.resumableInterview ? 'Ярилцлагаа үргэлжлүүлэх' : 'Ярилцлага эхлүүлэх',
      }}
      closingSrc={closingCover ? (urls.get(closingCover.path) ?? null) : null}
    />
  );
}

/* ---------------------------------------------------------------------------
   Data shaping
   --------------------------------------------------------------------------- */

type MemoryWithMedia = MemoryRow & {
  media?: Array<{ id: string; kind: string; variant: string; storage_path: string }>;
};

interface CoverEntry {
  memory: MemoryWithMedia;
  path: string;
}

/** The first original photograph attached to a memory, if it has one. */
function coverPath(memory: MemoryWithMedia): string | null {
  const cover = (memory.media ?? []).find(
    (item) => item.kind === 'photo' && item.variant === 'original',
  );
  return cover?.storage_path ?? null;
}

interface RawUnit {
  id: string;
  href: string;
  people: PersonNode[];
}

interface RawBand {
  key: string;
  label: string;
  units: RawUnit[];
  people: PersonNode[];
  overflow: number;
}

/** How many generations, and how many faces per generation, the cover shows. */
const MAX_BANDS = 4;
const MAX_UNITS_PER_BAND = 5;

/**
 * Group the family into one band of faces per generation, couples kept whole.
 *
 * Oldest generations first, and it is the NEWEST that get dropped when a family
 * outgrows the cover: the top of a tree is the part nobody else has a copy of.
 * Within a band a couple is one unit, because the archive is built out of
 * couples and splitting a pair here would misstate the shape of the family.
 */
function buildBands(graph: FamilyGraph, index: FamilyIndex): RawBand[] {
  const byGeneration = new Map<number, PersonNode[]>();
  for (const person of graph.people) {
    const generation = person.generation ?? 1;
    const bucket = byGeneration.get(generation) ?? [];
    bucket.push(person);
    byGeneration.set(generation, bucket);
  }

  return [...byGeneration.keys()]
    .sort((a, b) => a - b)
    .slice(0, MAX_BANDS)
    .map((generation) => {
      const members = byGeneration.get(generation) ?? [];
      const memberIds = new Set(members.map((person) => person.id));
      const placed = new Set<string>();
      const units: RawUnit[] = [];

      // Couples first, so a pair is never split apart by the fallback pass.
      for (const couple of graph.couples) {
        if (!memberIds.has(couple.person_a_id) || placed.has(couple.person_a_id)) continue;
        const a = index.people.get(couple.person_a_id);
        if (!a) continue;
        const b = couple.person_b_id ? index.people.get(couple.person_b_id) : undefined;
        placed.add(a.id);
        if (b) placed.add(b.id);
        units.push({ id: couple.id, href: `/couple/${couple.id}`, people: b ? [a, b] : [a] });
      }

      for (const person of members) {
        if (placed.has(person.id)) continue;
        placed.add(person.id);
        units.push({ id: person.id, href: `/person/${person.id}`, people: [person] });
      }

      const shown = units.slice(0, MAX_UNITS_PER_BAND);

      return {
        key: `generation-${generation}`,
        label: `${generation}-р үе`,
        units: shown,
        people: shown.flatMap((unit) => unit.people),
        overflow: units.slice(MAX_UNITS_PER_BAND).flatMap((unit) => unit.people).length,
      };
    });
}
