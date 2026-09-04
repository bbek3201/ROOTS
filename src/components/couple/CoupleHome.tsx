import Link from 'next/link';
import { Plate } from '@/components/home/Plate';
import { togetherFor, nextAnniversary } from '@/lib/couple/timeline';
import { InvitePartner } from '@/components/couple/InvitePartner';

/**
 * The couple space, as one page.
 *
 * Deliberately quieter than the family home, and quiet is the whole design.
 * The family archive opens on a full-bleed photograph and a three-line headline
 * because it is making a case for itself to nine relatives. This is a room two
 * people already live in: it opens the way a room does — their names, how long
 * it has been, and the doors — and it never raises its voice, because nobody
 * here needs persuading.
 *
 * Three rules hold it together:
 *
 *   1. Type carries the page, not chrome. The names are the largest thing on
 *      the screen and the rooms are an index, not a grid of icon tiles. A
 *      private space that looks like an app's settings menu is not private, it
 *      is administrative.
 *   2. Photographs are plates, never square thumbnails. A square crop is the
 *      shape of a feed; 4:5 is the shape of a print.
 *   3. Nothing is counted at the reader. No streaks, no badges, no activity.
 *      The one number on the page is how long they have been together.
 */
export interface CoupleHomeProps {
  spaceId: string;
  names: [string, string];
  startedOn: string | null;
  howWeMet: string | null;
  partnerJoined: boolean;
  counts: { memories: number; letters: number; places: number; voice: number; future: number };
  firsts: { filled: number; total: number };
  covers: Array<{ id: string; src: string | null; alt: string }>;
}

interface Room {
  href: string;
  label: string;
  /** What the room is for, in one line. Reads down the index as a sentence. */
  note: string;
  key: 'memories' | 'letters' | 'places' | 'voice' | 'future' | null;
}

const ROOMS: readonly Room[] = [
  { href: '/us/memories', label: 'Дурсамж',   note: 'Зураг, видео, тэр өдрийн түүх', key: 'memories' },
  { href: '/us/timeline', label: 'Он цаг',     note: 'Бүхнийг дараалалд нь',          key: null },
  { href: '/us/letters',  label: 'Захидал',    note: 'Бие биедээ бичсэн үгс',         key: 'letters' },
  { href: '/us/voice',    label: 'Дуу хоолой', note: 'Зураг барьж чадахгүй зүйл',     key: 'voice' },
  { href: '/us/places',   label: 'Газрууд',    note: 'Хамт очсон газар бүр',          key: 'places' },
  { href: '/us/future',   label: 'Ирээдүйд',   note: 'Тэр өдөр хүртэл нээгдэхгүй',    key: 'future' },
];

export function CoupleHome({
  spaceId, names, startedOn, howWeMet, partnerJoined, counts, firsts, covers,
}: CoupleHomeProps) {
  const together = togetherFor(startedOn);
  const anniversary = nextAnniversary(startedOn);
  const soon = anniversary && anniversary.daysAway <= 30 ? anniversary : null;

  const [lead, ...rest] = covers;

  return (
    <main id="main">
      {/* ================= The two of them ================================= */}
      {/* Their names, on paper, with air around them. No photograph behind the
          headline: the family home earns a full-bleed hero because it is a
          cover, and this is the first page of the book rather than its jacket. */}
      <section className="ed-shell pt-16 pb-14 text-center sm:pt-24 lg:pb-20">
        <p className="ed-eyebrow">Зөвхөн та хоёр</p>

        <h1 className="ed-display ed-display-xl mx-auto mt-7 max-w-[14ch] text-balance">
          {names[0]}
          <span className="mx-[0.25em] align-[0.06em] text-[0.62em] text-heart">❤</span>
          {names[1]}
        </h1>

        {together ? (
          <p className="ed-lead mx-auto mt-8 max-w-[32ch]">
            {together} хамт
            {startedOn ? (
              <span className="mt-2 block text-[0.78rem] tracking-[0.18em] text-[color-mix(in_srgb,#183b32_45%,transparent)] uppercase">
                {startedOn.slice(0, 10)}-аас хойш
              </span>
            ) : null}
          </p>
        ) : (
          <p className="ed-lead mx-auto mt-8 max-w-[34ch]">
            Хамт болсон өдрөө{' '}
            <Link href="/us/story" className="underline decoration-1 underline-offset-4">
              нэмбэл
            </Link>{' '}
            эндээс тоолж эхэлнэ.
          </p>
        )}

        {soon ? (
          <p className="mt-9 inline-flex items-baseline gap-2 border-y border-[color-mix(in_srgb,#183b32_14%,transparent)] px-5 py-3">
            <span className="ed-display text-2xl">{soon.years}</span>
            <span className="text-sm text-[color-mix(in_srgb,#183b32_60%,transparent)]">
              жилийн ой{' '}
              {soon.daysAway === 0 ? 'өнөөдөр' : `${soon.daysAway} хоногийн дараа`}
            </span>
          </p>
        ) : null}
      </section>

      {/* Waiting for the other half. Shown until they accept and never after —
          a standing "invite" button in a space for two is a bug. */}
      {!partnerJoined ? (
        <section className="ed-shell pb-16">
          <div className="mx-auto max-w-lg">
            <InvitePartner spaceId={spaceId} partnerName={names[1]} />
          </div>
        </section>
      ) : null}

      {/* ================= Their photographs =============================== */}
      {lead ? (
        <section className="ed-shell pb-16 lg:pb-24">
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <Link href="/us/memories" className="block">
              <Plate
                src={lead.src}
                alt={lead.alt || `${names[0]} ❤ ${names[1]}`}
                initial={names[0].slice(0, 1)}
                priority
                className="aspect-4/5 lg:aspect-3/4"
              />
            </Link>

            {rest.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:content-start">
                {rest.slice(0, 4).map((cover) => (
                  <Link key={cover.id} href="/us/memories" className="block">
                    <Plate
                      src={cover.src}
                      alt={cover.alt}
                      initial={names[1].slice(0, 1)}
                      className="aspect-square"
                    />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <p className="mt-7 text-center">
            <Link
              href="/us/memories"
              className="text-sm font-medium text-[#183b32] underline decoration-1 underline-offset-[6px]"
            >
              {counts.memories} дурсамж
            </Link>
          </p>
        </section>
      ) : null}

      {/* ================= Their story ===================================== */}
      {/* Set as a pull quote rather than in a card. What two people wrote about
          how they met is the most valuable text in the product, and a card with
          a border around it is how you make writing look like a form field. */}
      <section className="ed-band-cream py-16 lg:py-24">
        <div className="ed-shell text-center">
          <p className="ed-eyebrow">Бидний түүх</p>

          {howWeMet ? (
            <>
              <blockquote className="mx-auto mt-8 max-w-[46ch]">
                <p className="ed-display ed-display-md whitespace-pre-wrap text-balance leading-[1.35]">
                  {howWeMet}
                </p>
              </blockquote>
              <p className="mt-9">
                <Link
                  href="/us/story"
                  className="text-sm text-[color-mix(in_srgb,#183b32_60%,transparent)] underline decoration-1 underline-offset-4"
                >
                  Засах
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="ed-lead mx-auto mt-7 max-w-[38ch]">
                Хэрхэн танилцсанаа бичээрэй. Хэдэн жилийн дараа эдгээр хэдэн мөр хамгийн
                үнэтэй нь болно.
              </p>
              <Link href="/us/story" className="ed-btn ed-btn-primary mt-9">
                Түүхээ бичих
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ================= The index ======================================= */}
      {/* Rooms as a set of typographic rows rather than a grid of icon tiles.
          Six squares with a glyph in each is a launcher; this reads like the
          contents page of a book, which is what the space actually is. */}
      <section className="ed-shell py-16 lg:py-24">
        <ul className="mx-auto max-w-2xl border-t border-[color-mix(in_srgb,#183b32_12%,transparent)]">
          <li>
            <Link
              href="/us/firsts"
              className="group flex items-baseline gap-5 border-b border-[color-mix(in_srgb,#183b32_12%,transparent)] py-6"
            >
              <span className="min-w-0 flex-1">
                <span className="ed-display block text-2xl group-hover:underline decoration-1 underline-offset-[6px]">
                  Анхны мөчүүд
                </span>
                <span className="mt-1.5 block text-sm text-[color-mix(in_srgb,#183b32_55%,transparent)]">
                  Анх уулзсанаас эхний ой хүртэл
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-[color-mix(in_srgb,#183b32_45%,transparent)]">
                {firsts.filled}/{firsts.total}
              </span>
            </Link>
          </li>

          {ROOMS.map((room) => {
            const count = room.key ? counts[room.key] : null;
            return (
              <li key={room.href}>
                <Link
                  href={room.href}
                  className="group flex items-baseline gap-5 border-b border-[color-mix(in_srgb,#183b32_12%,transparent)] py-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="ed-display block text-2xl group-hover:underline decoration-1 underline-offset-[6px]">
                      {room.label}
                    </span>
                    <span className="mt-1.5 block text-sm text-[color-mix(in_srgb,#183b32_55%,transparent)]">
                      {room.note}
                    </span>
                  </span>
                  {/* An empty room says nothing rather than "0" — a zero is a
                      scolding, and every one of these starts empty. */}
                  {count ? (
                    <span className="shrink-0 text-sm tabular-nums text-[color-mix(in_srgb,#183b32_45%,transparent)]">
                      {count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ================= The promise ===================================== */}
      <section className="ed-shell pb-24">
        <p className="mx-auto max-w-[40ch] text-center text-sm leading-relaxed text-[color-mix(in_srgb,#183b32_50%,transparent)]">
          Энэ хуудсыг зөвхөн та хоёр харна. Гэр бүлийн бусад гишүүд ч, архивын админ ч
          эндэхийг харахгүй.
        </p>
      </section>
    </main>
  );
}
