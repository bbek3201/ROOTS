import Link from 'next/link';
import { Plate } from '@/components/home/Plate';
import { togetherFor, nextAnniversary } from '@/lib/couple/timeline';
import { InvitePartner } from '@/components/couple/InvitePartner';
import { formatDate } from '@/lib/format';

/**
 * The couple space — the sanctuary layout.
 *
 * A hero that names the two of them, a grid of six lit cards for the six rooms,
 * and a closing band that points back at the family tree the relationship sits
 * inside. Warm, unhurried, and unmistakably not the family archive: the cards
 * are the point of difference, because a private space should feel like a set
 * of doors you chose to open rather than an index you administer.
 *
 * Two things live here that the layout sketch could not show, and both stay on
 * purpose: the strip of their own photographs under the hero — a picture is the
 * product, and no ASCII drawing can represent one — and the pair of quieter
 * links under the grid for the timeline and the firsts, so that adopting a
 * six-card layout does not silently delete two rooms.
 *
 * The small-caps card labels are English while everything with meaning in it is
 * Mongolian. That is not a mixed language by accident: it is exactly what the
 * family home already does with Lineage / Moments / People / Voices, and the
 * two pages should sound like one product.
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
  /** The soonest sealed message, so the Future card can count down to something real. */
  nextUnlockAt?: string | null;
}

interface Room {
  href: string;
  mark: string;
  /** The small-caps label, as in the sketch. */
  label: string;
  /** Mongolian, and the line that actually says what is in there. */
  stat: string;
  action: string;
}

export function CoupleHome({
  spaceId, names, startedOn, howWeMet, partnerJoined, counts, firsts, covers,
  nextUnlockAt = null,
}: CoupleHomeProps) {
  const together = togetherFor(startedOn);
  const anniversary = nextAnniversary(startedOn);
  const soon = anniversary && anniversary.daysAway <= 30 ? anniversary : null;

  const rooms: Room[] = [
    {
      href: '/us/story', mark: '📖', label: 'Our Story',
      stat: howWeMet ? 'Хэрхэн танилцсан' : 'Хараахан бичээгүй',
      action: howWeMet ? 'Түүхийг унших' : 'Түүхээ бичих',
    },
    {
      href: '/us/memories', mark: '📸', label: 'Memories',
      stat: counts.memories > 0 ? `🔥 ${counts.memories} мөч` : 'Эхний зургаа нэмээрэй',
      action: 'Галерей нээх',
    },
    {
      href: '/us/letters', mark: '💌', label: 'Love Letters',
      stat: counts.letters > 0 ? `🔒 ${counts.letters} захидал` : 'Нэг ч захидал алга',
      action: 'Захидал нээх',
    },
    {
      href: '/us/voice', mark: '🎙️', label: 'Sweet Voices',
      stat: counts.voice > 0 ? `🎧 ${counts.voice} бичлэг` : 'Хоолойгоо үлдээгээрэй',
      action: 'Сонсох',
    },
    {
      href: '/us/places', mark: '🗺️', label: 'Our Places',
      stat: counts.places > 0 ? `📍 ${counts.places} газар` : 'Очсон газраа тэмдэглэх',
      action: 'Газруудыг үзэх',
    },
    {
      href: '/us/future', mark: '🔐', label: 'Future Lock',
      // Counts down to a message they actually sealed, not to a placeholder.
      stat: nextUnlockAt
        ? `⏳ ${formatDate(nextUnlockAt.slice(0, 10), 'exact')}`
        : 'Ирээдүйдээ захиа үлдээх',
      action: counts.future > 0 ? `${counts.future} захиа` : 'Захиа үлдээх',
    },
  ];

  const [lead, ...rest] = covers;

  return (
    <main id="main">
      {/* ================= Hero ============================================ */}
      <section className="rt-gutters pt-14 pb-12 text-center sm:pt-20">
        <p aria-hidden="true" className="text-2xl">💖 ✨</p>

        <h1 className="ed-display ed-display-xl mx-auto mt-6 max-w-[16ch] text-balance">
          <span aria-hidden="true" className="mr-3 align-middle text-[0.5em]">✨</span>
          {names[0]}
          <span className="mx-[0.22em] text-heart">+</span>
          {names[1]}
          <span aria-hidden="true" className="ml-3 align-middle text-[0.5em]">✨</span>
        </h1>

        {together ? (
          <p className="ed-lead mx-auto mt-7 max-w-[36ch]">
            “{startedOn ? `${formatDate(startedOn.slice(0, 10), 'exact')}-аас хойш` : 'Хамтдаа'} —{' '}
            {together}”
          </p>
        ) : (
          <p className="ed-lead mx-auto mt-7 max-w-[36ch]">
            Хамт болсон өдрөө{' '}
            <Link href="/us/story" className="underline decoration-1 underline-offset-4">нэмбэл</Link>{' '}
            эндээс тоолж эхэлнэ.
          </p>
        )}

        {soon ? (
          <p className="mt-6 inline-flex items-baseline gap-2 rounded-pill bg-[color-mix(in_srgb,#f3d8d4_60%,transparent)] px-5 py-2">
            <span aria-hidden="true">🎉</span>
            <span className="text-sm text-[#183b32]">
              {soon.years} жилийн ой{' '}
              {soon.daysAway === 0 ? 'өнөөдөр' : `${soon.daysAway} хоногийн дараа`}
            </span>
          </p>
        ) : null}

        <p className="mt-9">
          <Link href="/us/memories/new" className="ed-btn ed-btn-primary">
            <span aria-hidden="true">💌</span> Шинэ дурсамж нэмэх
          </Link>
        </p>
      </section>

      {/* Waiting for the other half. Shown until they accept and never after. */}
      {!partnerJoined ? (
        <section className="rt-gutters pb-12">
          <div className="mx-auto max-w-lg">
            <InvitePartner spaceId={spaceId} partnerName={names[1]} />
          </div>
        </section>
      ) : null}

      {/* ================= Their photographs =============================== */}
      {/* Not in the sketch, because a sketch cannot draw one. Kept, because a
          photograph is the product and a wall of cards about photographs is
          not the same thing as the photographs. */}
      {lead ? (
        <section className="rt-gutters pb-14">
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-stretch">
            <Link href="/us/memories" className="block lg:h-full">
              <Plate
                src={lead.src}
                alt={lead.alt || `${names[0]} + ${names[1]}`}
                initial={names[0].slice(0, 1)}
                priority
                className="aspect-4/5 lg:aspect-auto lg:h-full"
              />
            </Link>

            {rest.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:h-full lg:grid-rows-2">
                {rest.slice(0, 4).map((cover) => (
                  <Link key={cover.id} href="/us/memories" className="block lg:h-full">
                    <Plate
                      src={cover.src}
                      alt={cover.alt}
                      initial={names[1].slice(0, 1)}
                      className="aspect-square lg:aspect-auto lg:h-full"
                    />
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="rt-gutters">
        <hr className="border-t border-[color-mix(in_srgb,#183b32_12%,transparent)]" />
      </div>

      {/* ================= The rooms ======================================= */}
      <section className="rt-gutters py-14 lg:py-20">
        <h2 className="ed-eyebrow">
          Our shared heartbeat <span aria-hidden="true">❤️</span>
        </h2>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {rooms.map((room) => (
            <li key={room.href}>
              <Link
                href={room.href}
                className="card-hero group flex h-full flex-col p-6 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <span aria-hidden="true" className="text-2xl">{room.mark}</span>

                <span className="eyebrow mt-4 block">{room.label}</span>

                <span className="mt-2 block text-[1.05rem] leading-snug text-ink">
                  {room.stat}
                </span>

                {/* Pushed to the bottom so every card's action sits on one line
                    across the row, however long the line above it runs. */}
                <span className="mt-auto pt-5 text-sm font-medium text-forest group-hover:underline decoration-1 underline-offset-4">
                  <span aria-hidden="true">✨</span> {room.action} →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* The two rooms the six-card layout has no slot for. Quieter, but
            present — adopting a layout must not delete a feature. */}
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:gap-5">
          <li>
            <Link href="/us/timeline" className="card flex items-center gap-4 p-5">
              <span aria-hidden="true" className="text-xl">🕰️</span>
              <span className="min-w-0 flex-1">
                <span className="eyebrow block">Our timeline</span>
                <span className="mt-1 block text-[0.95rem] text-ink">Бүхнийг дараалалд нь</span>
              </span>
              <span className="shrink-0 text-muted">→</span>
            </Link>
          </li>
          <li>
            <Link href="/us/firsts" className="card flex items-center gap-4 p-5">
              <span aria-hidden="true" className="text-xl">❤️</span>
              <span className="min-w-0 flex-1">
                <span className="eyebrow block">Our firsts</span>
                <span className="mt-1 block text-[0.95rem] text-ink">
                  {firsts.filled}/{firsts.total} бөглөгдсөн
                </span>
              </span>
              <span className="shrink-0 text-muted">→</span>
            </Link>
          </li>
        </ul>
      </section>

      <div className="rt-gutters">
        <hr className="border-t border-[color-mix(in_srgb,#183b32_12%,transparent)]" />
      </div>

      {/* ================= Back to the tree ================================ */}
      {/* The one place the private space points outward. It is also the truest
          sentence in the product: this relationship is a row in the family
          tree, and the children hang off the same couple. */}
      <section className="rt-gutters py-16 lg:py-24">
        <div className="ed-band-sage rounded-[32px] px-7 py-14 text-center sm:px-14">
          <p aria-hidden="true" className="text-2xl">🌳</p>
          <h2 className="ed-display ed-display-md mx-auto mt-5 max-w-[24ch] text-balance">
            Энэ хайраас нэг удам ургана
          </h2>
          <Link href="/family/tree" className="ed-btn ed-btn-ghost mt-8">
            <span aria-hidden="true">🌿</span> Гэр бүлийн модоо үзэх
          </Link>
        </div>
      </section>

      <section className="rt-gutters pb-20">
        <p className="mx-auto max-w-[40ch] text-center text-sm leading-relaxed text-[color-mix(in_srgb,#183b32_50%,transparent)]">
          Энэ хуудсыг зөвхөн та хоёр харна. Гэр бүлийн бусад гишүүд ч, архивын админ ч
          эндэхийг харахгүй.
        </p>
      </section>
    </main>
  );
}
