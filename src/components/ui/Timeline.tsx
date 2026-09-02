import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

/**
 * The rail a family's chronology hangs from.
 *
 * A plain divided list reads as a table of rows; a rail with dots reads as
 * time passing, which is the whole point of the screen. The line is drawn on
 * the list rather than per item so it never breaks between entries, and it is
 * inset behind the dots so an undated entry can sit on the same rail with a
 * hollow marker instead of being exiled to a different layout.
 */
export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ol className={cn('relative space-y-1 py-1', className)}>
      {/* left-7 puts the rail exactly under the dots: 0.75rem of row padding
          plus half of the 2rem marker column. */}
      <span
        aria-hidden="true"
        className="absolute bottom-5 left-7 top-5 w-px bg-forest/20"
      />
      {children}
    </ol>
  );
}

export function TimelineEntry({
  year,
  title,
  description,
  meta,
  badge,
  href,
  muted = false,
}: {
  year: string;
  title: string;
  description?: string | null;
  meta?: string;
  badge?: ReactNode;
  href?: string;
  /** An undated entry: same rail, hollow marker. */
  muted?: boolean;
}) {
  const body = (
    <div className="flex gap-3 rounded-2xl px-3 py-2.5 transition-colors">
      <span className="relative z-10 flex w-8 shrink-0 justify-center pt-1.5">
        <span
          aria-hidden="true"
          className={cn(
            'h-2.5 w-2.5 rounded-full ring-4 ring-surface',
            muted ? 'bg-surface outline outline-2 outline-line' : 'bg-forest',
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm text-olive">{year}</span>
          {badge}
        </span>
        <span className="mt-0.5 block text-[0.95rem] font-medium leading-snug text-ink">{title}</span>
        {description ? (
          <span className="mt-0.5 block line-clamp-2 text-sm text-muted">{description}</span>
        ) : null}
        {meta ? <span className="mt-0.5 block text-xs text-muted">{meta}</span> : null}
      </span>
    </div>
  );

  return (
    <li>
      {href ? (
        <Link href={href} className="block hover:[&>div]:bg-forest-wash/60">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}
