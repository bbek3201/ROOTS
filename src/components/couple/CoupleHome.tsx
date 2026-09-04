import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { togetherFor, nextAnniversary } from '@/lib/couple/timeline';
import { InvitePartner } from '@/components/couple/InvitePartner';
import {
  ClockIcon, HeartIcon, MapPinIcon, MemoryIcon, MicIcon, ShieldIcon,
} from '@/components/icons';

/**
 * The couple space, as one page.
 *
 * Deliberately quieter than the family home. The family archive opens on a
 * full-bleed photograph and a headline because it is trying to make a case for
 * itself to nine relatives; this is a room two people already live in, and it
 * should open the way a room does — their names, how long it has been, and the
 * doors.
 *
 * No counts of likes, no activity feed, no faces of anyone else. Everything on
 * this page is either the two of them or a way into something they wrote.
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

const ROOMS = [
  { href: '/us/memories', label: 'Дурсамж', Icon: MemoryIcon, key: 'memories' as const },
  { href: '/us/timeline', label: 'Он цаг', Icon: ClockIcon, key: null },
  { href: '/us/letters', label: 'Захидал', Icon: HeartIcon, key: 'letters' as const },
  { href: '/us/voice', label: 'Дуу хоолой', Icon: MicIcon, key: 'voice' as const },
  { href: '/us/places', label: 'Газрууд', Icon: MapPinIcon, key: 'places' as const },
  { href: '/us/future', label: 'Ирээдүйд', Icon: ShieldIcon, key: 'future' as const },
];

export function CoupleHome({
  spaceId, names, startedOn, howWeMet, partnerJoined, counts, firsts, covers,
}: CoupleHomeProps) {
  const together = togetherFor(startedOn);
  const anniversary = nextAnniversary(startedOn);

  return (
    <main id="main" className="px-4 pb-10 pt-4 sm:px-5">
      {/* ---- the two of them ---- */}
      <section className="pt-6 text-center">
        <p className="eyebrow">Хоёулаа</p>
        <h1 className="ed-display ed-display-lg mt-3 text-balance">
          {names[0]} <span className="text-heart">❤</span> {names[1]}
        </h1>

        {together ? (
          <p className="mt-4 text-sm text-muted">
            {startedOn ? `${startedOn.slice(0, 10)}-аас хойш · ` : null}
            <span className="text-ink">{together}</span>
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">Эхэлсэн огноогоо нэмээгүй байна.</p>
        )}

        {anniversary && anniversary.daysAway <= 30 ? (
          <p className="mt-3 inline-flex rounded-pill bg-forest-wash px-3 py-1.5 text-xs text-forest">
            {anniversary.daysAway === 0
              ? `Өнөөдөр ${anniversary.years} жилийн ой ❤`
              : `${anniversary.years} жилийн ой хүртэл ${anniversary.daysAway} хоног`}
          </p>
        ) : null}
      </section>

      {/* Waiting for the other half. Shown until they accept, and never after —
          a persistent "invite" button in a space for two is a bug. */}
      {!partnerJoined ? (
        <section className="mt-8">
          <InvitePartner spaceId={spaceId} partnerName={names[1]} />
        </section>
      ) : null}

      {/* ---- recent photographs ---- */}
      {covers.length > 0 ? (
        <section className="mt-8">
          <ul className="grid grid-cols-3 gap-1.5">
            {covers.map((cover) => (
              <li key={cover.id}>
                <Link
                  href="/us/memories"
                  className="block aspect-square overflow-hidden rounded-xl border border-line bg-parchment-deep"
                >
                  {cover.src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
                    <img src={cover.src} alt={cover.alt} loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- our story ---- */}
      <section className="mt-8">
        <Card>
          <p className="eyebrow">Бидний түүх</p>
          {howWeMet ? (
            <p className="mt-2.5 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink">
              {howWeMet}
            </p>
          ) : (
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              Хэрхэн танилцсанаа бичээрэй. Хэдэн жилийн дараа энэ хэдэн мөр хамгийн үнэтэй нь болно.
            </p>
          )}
          <Link href="/us/story" className="mt-4 inline-flex text-sm font-medium text-forest underline">
            {howWeMet ? 'Түүхээ засах' : 'Түүхээ бичих'}
          </Link>
        </Card>
      </section>

      {/* ---- the firsts, as a single progress line rather than nine cards ---- */}
      <section className="mt-4">
        <Link href="/us/firsts" className="card flex items-center gap-3 p-4">
          <span className="text-xl">❤️</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">Анхны мөчүүд</span>
            <span className="block text-xs text-muted">
              {firsts.filled === 0
                ? 'Нэг ч бичигдээгүй байна'
                : `${firsts.filled}/${firsts.total} бөглөгдсөн`}
            </span>
          </span>
          <span className="text-sm text-muted">→</span>
        </Link>
      </section>

      {/* ---- the rooms ---- */}
      <section className="mt-8">
        <ul className="grid grid-cols-2 gap-2.5">
          {ROOMS.map((room) => {
            const count = room.key ? counts[room.key] : null;
            return (
              <li key={room.href}>
                <Link href={room.href} className="card flex h-full flex-col gap-2 p-4">
                  <room.Icon size={20} className="text-sage" />
                  <span className="text-sm font-medium text-ink">{room.label}</span>
                  <span className="text-xs text-muted">
                    {count === null ? 'Он цагийн хэлхээс' : count === 0 ? 'Хоосон' : `${count}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-8 text-center text-xs leading-relaxed text-muted">
        Энэ хэсгийг зөвхөн та хоёр харна. Гэр бүлийн бусад гишүүд, архивын админ ч үүнийг харахгүй.
      </p>
    </main>
  );
}
