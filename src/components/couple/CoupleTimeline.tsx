import Link from 'next/link';
import { EmptyState } from '@/components/ui/States';
import type { TimelineYear } from '@/lib/couple/timeline';

const KIND_MARK: Record<string, string> = {
  memory: '📷', first: '❤️', place: '📍', letter: '💌', voice: '🎙️',
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
        icon="🕰️"
        title="Он цагийн хэлхээс хоосон байна"
        description="Огноотой дурсамж нэмэх бүрд энэ хэлхээс өөрөө уртсана."
        action={{ label: 'Дурсамж нэмэх', href: '/us/memories/new' }}
      />
    );
  }

  return (
    <div className="space-y-10">
      {years.map((year) => (
        <section key={year.year}>
          <h2 className="ed-display text-3xl text-ink">{year.year}</h2>

          <ul className="mt-4 border-l border-line pl-5">
            {year.entries.map((entry) => (
              <li key={entry.id} className="relative pb-6 last:pb-0">
                <span
                  aria-hidden="true"
                  className="absolute -left-[1.72rem] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-parchment text-[0.7rem]"
                >
                  {KIND_MARK[entry.kind] ?? '•'}
                </span>

                <Link href={entry.href} className="flex items-start gap-3">
                  {entry.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
                    <img
                      src={entry.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-xl border border-line object-cover"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.95rem] font-medium leading-snug text-ink">
                      {entry.title}
                    </span>
                    <span className="block text-xs text-muted">
                      {[entry.date, entry.subtitle].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
