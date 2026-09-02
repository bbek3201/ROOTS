import { cn } from '@/lib/cn';
import { initials, type NameLike } from '@/lib/format';
import type { LifeStatus } from '@/types/database';

interface PersonLike extends NameLike {
  life_status?: LifeStatus;
}

const SIZES = {
  xs: 'h-8 w-8 text-xs',
  sm: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-lg',
  lg: 'h-20 w-20 text-2xl',
  xl: 'h-28 w-28 text-4xl',
} as const;

/**
 * A person's avatar.
 *
 * When there is no photograph — which is the normal case for anyone born before
 * about 1950 — this shows their initial on a tinted ground rather than a grey
 * silhouette. An ancestor with no surviving photo should still look like a
 * person on the screen, not like missing data.
 */
export function Avatar({
  person,
  photoUrl,
  size = 'md',
  className,
}: {
  person: PersonLike | null | undefined;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const deceased = person?.life_status === 'deceased';

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'border border-line bg-gold-wash font-display text-ink-soft',
        SIZES[size],
        className,
      )}
      aria-hidden="true"
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage URLs are
        // short-lived signed URLs, which the Next image optimiser cannot cache.
        <img src={photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span>{initials(person)}</span>
      )}
      {deceased ? (
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-muted/30" />
      ) : null}
    </span>
  );
}
