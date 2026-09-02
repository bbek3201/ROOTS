import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { getFamilyGraph, getFamilyHome, getMediaPaths, type MemoryWithCover } from '@/lib/data/family';
import { buildFamilyIndex, getCoupleChildren } from '@/lib/relationships/graph';
import { getFamilyTimeline } from '@/lib/data/timeline';
import { getSignedUrls } from '@/lib/media/storage';
import { Photo, PhotoOverlay } from '@/components/ui/Photo';
import { Display, Eyebrow, SectionLead } from '@/components/ui/Editorial';
import { EmptyState } from '@/components/ui/States';
import { Avatar } from '@/components/ui/Avatar';
import { ChevronRightIcon, MicIcon, SearchIcon, TreeIcon } from '@/components/icons';
import { displayName, formatDate, yearOf } from '@/lib/format';
import type { PersonNode } from '@/lib/relationships/types';

export const dynamic = 'force-dynamic';

/**
 * The home screen.
 *
 * It opens with a photograph at full bleed and the family's name over it,
 * because the first thing someone should feel on opening ROOTS is recognition,
 * not navigation. Everything below is a single column of quiet sections in
 * order of how alive they are: the newest memory, the moments behind it, the
 * dates the family is heading towards, and the people themselves.
 *
 * Deliberately absent: counters in badges, activity feeds, dashboards. A count
 * of rows is what a database is proud of, not what a family is.
 */
export default async function FamilyHomePage() {
  const membership = await requireActiveFamily();
  const familyId = membership.family_id;

  const [graph, home, timeline] = await Promise.all([
    getFamilyGraph(familyId),
    getFamilyHome(familyId),
    getFamilyTimeline(familyId, 4),
  ]);

  const withCovers = home.recentMemories
    .map((memory) => ({ memory, path: coverPath(memory) }))
    .filter((entry): entry is { memory: MemoryWithCover; path: string } => entry.path !== null);

  // Faces for the connections strip: the people closest to the viewer if we
  // know who they are, otherwise the oldest generation.
  const people = [...graph.people].sort(
    (a, b) => (a.generation ?? 99) - (b.generation ?? 99) || (a.birth_date ?? '').localeCompare(b.birth_date ?? ''),
  );
  const featuredPeople = people.slice(0, 8);

  // A family in ROOTS is a chain of couples, not a list of individuals — so the
  // couples come before the people on the home screen, with the oldest first.
  const index = buildFamilyIndex(graph);
  const couples = [...graph.couples]
    .filter((couple) => couple.person_b_id)
    .sort((a, b) => (a.marriage_date ?? '9999').localeCompare(b.marriage_date ?? '9999'))
    .slice(0, 6)
    .map((couple) => ({
      couple,
      a: index.people.get(couple.person_a_id),
      b: couple.person_b_id ? index.people.get(couple.person_b_id) : undefined,
      children: getCoupleChildren(index, couple.id).length,
    }));

  const personPhotoPaths = await getMediaPaths([
    ...featuredPeople.map((person) => person.profile_photo_media_id),
    ...couples.flatMap((entry) => [entry.a?.profile_photo_media_id, entry.b?.profile_photo_media_id]),
  ]);

  const urls = await getSignedUrls([
    ...withCovers.map((entry) => entry.path),
    ...personPhotoPaths.values(),
  ]);

  const [featured, ...moments] = withCovers;
  const heroMemory = featured?.memory;
  const generations = new Set(graph.people.map((person) => person.generation ?? 0)).size;
  const isEmpty = graph.people.length === 0;

  return (
    <main id="main" className="pb-10">
      {/* ---- Hero ------------------------------------------------------ */}
      <section className="relative">
        <Photo
          src={featured ? urls.get(featured.path) : null}
          alt={heroMemory ? heroMemory.title : membership.family.name}
          ratio="hero"
          rounded={false}
          priority
          initial={membership.family.name.slice(0, 1)}
          className="rounded-b-4xl"
        >
          <PhotoOverlay className="p-6 pb-7">
            <Eyebrow className="text-white/70">Танай гэр бүл</Eyebrow>
            <Display size="xl" className="mt-2 text-white">
              {membership.family.name}
            </Display>
            <p className="mt-2.5 text-sm text-white/80">
              {graph.people.length > 0
                ? `${generations} үеийн ${graph.people.length} хүн · ${home.counts.memories} дурсамж`
                : 'Эхний хүнээ нэмээд эхлүүлье'}
            </p>
          </PhotoOverlay>
        </Photo>

        <Link
          href="/search"
          aria-label="Хайх"
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md transition-colors hover:bg-black/40"
        >
          <SearchIcon size={19} />
        </Link>
      </section>

      <div className="px-5">
        {isEmpty ? (
          <EmptyState
            className="mt-8"
            icon={<TreeIcon size={30} />}
            title="Архив хоосон байна"
            description="Хамгийн ахмад хүнээсээ эхэлье. Хос, хүүхдүүдийг нэмэхэд хамаарал автоматаар бүрдэнэ."
            action={{ label: 'Эхний хүнийг нэмэх', href: '/family/add-person' }}
          />
        ) : null}

        {/* ---- The newest memory, told rather than listed ---------------- */}
        {heroMemory ? (
          <section className="mt-9">
            <Eyebrow className="mb-3">Сүүлийн дурсамж</Eyebrow>
            <Link href={`/memories/${heroMemory.id}`} className="group block">
              <Display as="h3" size="md" className="transition-colors group-hover:text-forest">
                {heroMemory.title}
              </Display>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft measure line-clamp-3">
                {heroMemory.description ?? heroMemory.body ?? ''}
              </p>
              <p className="mt-3 text-sm text-muted">
                {heroMemory.memory_date
                  ? formatDate(heroMemory.memory_date, heroMemory.date_precision)
                  : 'Огноо тодорхойгүй'}
                {' · '}
                {heroMemory.contributor_name}
              </p>
            </Link>
          </section>
        ) : null}

        {/* ---- Moments: photographs, edge to edge ------------------------ */}
        {moments.length > 0 ? (
          <section className="mt-10">
            <SectionLead
              label="Гэр бүлийн мөчүүд"
              title="Дурсамжийн хана"
              action={<Link href="/memories">Бүгд</Link>}
            />
            <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
              {moments.slice(0, 8).map(({ memory, path }) => (
                <Link key={memory.id} href={`/memories/${memory.id}`} className="w-40 shrink-0">
                  <Photo
                    src={urls.get(path)}
                    alt={memory.title}
                    ratio="portrait"
                    initial={memory.title.slice(0, 1)}
                  />
                  <p className="mt-2 truncate text-sm text-ink">{memory.title}</p>
                  <p className="truncate text-xs text-muted">
                    {memory.memory_date ? yearOf(memory.memory_date) : ''}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ---- Couples: the unit the whole archive is built from --------- */}
        {couples.length > 0 ? (
          <section className="mt-10">
            <SectionLead
              label="Гэр бүлийн үндэс"
              title="Хосууд"
              action={<Link href="/family/tree">Мод</Link>}
            />
            <ul className="divide-y divide-line/70">
              {couples.map(({ couple, a, b, children }) => (
                <li key={couple.id}>
                  <Link href={`/couple/${couple.id}`} className="flex items-center gap-4 py-4">
                    <span className="flex shrink-0 items-center">
                      <Avatar
                        person={a ?? null}
                        photoUrl={a ? photoUrlFor(a, personPhotoPaths, urls) : null}
                        size="md"
                      />
                      <Avatar
                        person={b ?? null}
                        photoUrl={b ? photoUrlFor(b, personPhotoPaths, urls) : null}
                        size="md"
                        className="-ml-4 ring-2 ring-parchment"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[1.15rem] text-ink">
                        {displayName(a)} <span className="text-heart">♥</span> {displayName(b)}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {[
                          couple.marriage_date ? `${yearOf(couple.marriage_date)} оноос` : null,
                          children > 0 ? `${children} хүүхэд` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Огноо тодорхойгүй'}
                      </span>
                    </span>
                    <ChevronRightIcon size={17} className="shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---- Dates ---------------------------------------------------- */}
        {timeline.length > 0 ? (
          <section className="mt-10">
            <SectionLead label="Он цагийн хэлхээс" title="Чухал огноо" />
            <ul className="divide-y divide-line/70">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex items-baseline gap-5 py-3.5">
                  <span className="w-12 shrink-0 font-display text-[1.05rem] text-sage">
                    {yearOf(entry.date) || '—'}
                  </span>
                  <span className="min-w-0 flex-1 text-[0.95rem] text-ink">{entry.title}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---- People --------------------------------------------------- */}
        {featuredPeople.length > 0 ? (
          <section className="mt-10">
            <SectionLead
              label="Гэр бүлийн холбоо"
              title="Танай хүмүүс"
              action={<Link href="/family/tree">Мод</Link>}
            />
            <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5">
              {featuredPeople.map((person) => (
                <PersonChip
                  key={person.id}
                  person={person}
                  photoUrl={photoUrlFor(person, personPhotoPaths, urls)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* ---- The one prompt on the screen ------------------------------ */}
        <section className="mt-10">
          <Link
            href={home.resumableInterview ? `/interview/${home.resumableInterview.id}` : '/interview'}
            className="flex items-center gap-4 rounded-(--radius-card) bg-sage-wash px-5 py-5 transition-colors hover:bg-forest-wash"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-forest">
              <MicIcon size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[1.05rem] text-ink">
                {home.resumableInterview ? 'Ярилцлагаа үргэлжлүүлэх' : 'Дуу хоолойг нь үлдээе'}
              </span>
              <span className="mt-0.5 block text-sm text-ink-soft">
                {home.resumableInterview
                  ? (home.resumableInterview.title ?? 'Амьдралын түүх')
                  : 'Хорин асуулт. Хариултууд нь үүрд үлдэнэ.'}
              </span>
            </span>
            <ChevronRightIcon size={18} className="shrink-0 text-sage" />
          </Link>
        </section>
      </div>
    </main>
  );
}

function PersonChip({ person, photoUrl }: { person: PersonNode; photoUrl: string | null }) {
  return (
    <Link href={`/person/${person.id}`} className="w-18 shrink-0 text-center">
      <Avatar person={person} photoUrl={photoUrl} size="lg" className="mx-auto" />
      <span className="mt-2 block truncate text-xs text-ink">{displayName(person)}</span>
      <span className="block truncate text-[0.7rem] text-muted">{yearOf(person.birth_date) || ''}</span>
    </Link>
  );
}

/** The first original photograph attached to a memory, if it has one. */
function coverPath(memory: MemoryWithCover): string | null {
  const cover = (memory.media ?? []).find(
    (item) => item.kind === 'photo' && item.variant === 'original',
  );
  return cover?.storage_path ?? null;
}

function photoUrlFor(
  person: PersonNode,
  paths: Map<string, string>,
  urls: Map<string, string>,
): string | null {
  const path = person.profile_photo_media_id ? paths.get(person.profile_photo_media_id) : null;
  return path ? (urls.get(path) ?? null) : null;
}
