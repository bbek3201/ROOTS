import Link from 'next/link';

export interface CoupleCardProps {
  names: [string, string];
  together: string | null;
  counts: { memories: number; letters: number; places: number };
  /** Shown while the second partner has not accepted yet. */
  waiting: boolean;
}

/**
 * The one place the family home mentions the couple space.
 *
 * It says the two names, how long, and three counts — and nothing about what is
 * inside. The family home is a page other relatives will look over your
 * shoulder at, so this card is written to be readable by anyone standing behind
 * you while telling them nothing.
 *
 * Rendered only for someone who is in a space. There is no version of this card
 * that says "your daughter has a private space", because that sentence is
 * already more than an archive should say.
 */
export function CoupleCard({ names, together, counts, waiting }: CoupleCardProps) {
  return (
    <section className="rt-gutters py-14 lg:py-20">
      <Link
        href="/us"
        className="ed-band-cream group block rounded-[32px] px-7 py-10 sm:px-12 sm:py-14"
      >
        <p className="ed-eyebrow">Зөвхөн та хоёр</p>

        <h2 className="ed-display ed-display-lg mt-5 text-balance">
          {names[0]} <span className="text-heart">❤</span> {names[1]}
        </h2>

        {together ? (
          <p className="ed-lead mt-4 text-[1.05rem]">{together} хамт</p>
        ) : null}

        {waiting ? (
          <p className="mt-6 inline-flex rounded-pill bg-white/70 px-3 py-1.5 text-xs text-ink-soft">
            Ханиа хүлээж байна…
          </p>
        ) : (
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-[#183b32]">
            <Count value={counts.memories} label="дурсамж" />
            <Count value={counts.letters} label="захидал" />
            <Count value={counts.places} label="газар" />
          </dl>
        )}

        <p className="mt-8 text-sm font-medium text-forest group-hover:underline">
          Бидний түүхийг нээх →
        </p>
      </Link>
    </section>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only-text">{label}</dt>
      <dd>
        <span className="ed-display text-3xl">{value}</span>{' '}
        <span className="text-sm text-[color-mix(in_srgb,#183b32_55%,transparent)]">{label}</span>
      </dd>
    </div>
  );
}
