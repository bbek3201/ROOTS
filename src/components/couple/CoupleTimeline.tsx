import Link from 'next/link';
import { EmptyState } from '@/components/ui/States';
import { HeartIcon, LetterIcon, MapPinIcon, MemoryIcon, MicIcon } from '@/components/icons';
import type { CoupleEntryKind, TimelineYear } from '@/lib/couple/timeline';

/**
 * One glyph per kind, from the app's own icon set rather than emoji.
 *
 * Emoji render differently on every platform, carry someone else's colour into
 * a two-colour page, and read as decoration. These inherit currentColor, so the
 * rail stays one material.
 */
const KIND_ICON: Record<CoupleEntryKind, typeof HeartIcon> = {
  memory: MemoryIcon,
  first: HeartIcon,
  place: MapPinIcon,
  letter: LetterIcon,
  voice: MicIcon,
};

/**
 * The relationship, in order.
 *
 * Years descend — this year is what you came back for — but inside a year the
 * story runs forwards, because January then June then December is how the year
 * actually happened. Both directions at once is the only arrangement that reads
 * correctly from either end.
 */
export function CoupleTimeline({ years }: { years: TimelineYear[] }) {
  if (years.length === 0) {
    return (
      <EmptyState
        title="Он цагийн хэлхээс хоосон байна"
        description="Огноотой дурсамж нэмэх бүрд энэ хэлхээс өөрөө уртсана."
        action={{ label: 'Дурсамж нэмэх', href: '/us/memories/new' }}
      />
    );
  }

  return (
    <div className="space-y-14">
      {years.map((year) => (
        <section key={year.year}>
          {/* The year is a milestone on the rail, not a heading above it — it
              sits on the same line the entries hang from, so a long timeline
              reads as one continuous thread rather than as stacked lists. */}
          <h2 className="ed-display ed-display-md text-[color-mix(in_srgb,#183b32_35%,transparent)]">
            {year.year}
          </h2>

          <ul className="mt-5 border-l border-line pl-7">
            {year.entries.map((entry) => {
              const Glyph = KIND_ICON[entry.kind];
              return (
                <li key={entry.id} className="relative pb-8 last:pb-0">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[2.4rem] top-0 flex h-7 w-7 items-center justify-center rounded-full bg-parchment text-sage ring-1 ring-line"
                  >
                    <Glyph size={14} />
                  </span>

                  <Link href={entry.href} className="group flex items-start gap-4">
                    {entry.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
                      <img
                        src={entry.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-16 w-14 shrink-0 rounded-lg border border-line object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1.05rem] leading-snug text-ink group-hover:underline decoration-1 underline-offset-4">
                        {entry.title}
                      </span>
                      <span className="mt-1 block text-xs tracking-[0.08em] text-muted uppercase">
                        {[entry.date, entry.subtitle].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
