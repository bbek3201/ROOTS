import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

const RATIOS = {
  square: 'aspect-square',
  portrait: 'aspect-4/5',
  tall: 'aspect-3/4',
  landscape: 'aspect-3/2',
  wide: 'aspect-16/10',
  hero: 'aspect-4/5 sm:aspect-3/2',
  fill: 'h-full w-full',
} as const;

export type PhotoRatio = keyof typeof RATIOS;

/**
 * A photograph, and what stands in its place when there isn't one.
 *
 * Most of a family archive arrives without pictures: a great-grandmother born
 * in 1911 has a name, a year and a story long before anyone finds a print of
 * her. So the empty state here is not an error state — it is the normal state,
 * and it has to look like part of the album. A warm sage-and-beige ground with
 * the person's or memory's initial holds the same space the photograph will
 * hold later, so nothing in the layout moves on the day someone scans it.
 *
 * Storage URLs are short-lived signed links, which is why this is a plain <img>
 * rather than next/image: the optimiser would cache a URL that expires.
 */
export function Photo({
  src,
  alt,
  ratio = 'landscape',
  initial,
  className,
  imgClassName,
  children,
  priority = false,
  rounded = true,
}: {
  src?: string | null;
  alt: string;
  ratio?: PhotoRatio;
  /** Shown when there is no photograph — usually a name's first letter. */
  initial?: string;
  className?: string;
  imgClassName?: string;
  /** Overlays: a scrim, a caption, a back button. */
  children?: ReactNode;
  priority?: boolean;
  rounded?: boolean;
}) {
  return (
    <div
      className={cn(
        'photo-frame',
        RATIOS[ratio],
        !rounded && 'rounded-none',
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL, see above.
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : undefined}
          className={cn('h-full w-full object-cover', imgClassName)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center font-display text-[clamp(2rem,18cqw,5rem)] text-sage/45"
          style={{ containerType: 'inline-size' }}
        >
          {initial ?? ''}
        </span>
      )}
      {children}
    </div>
  );
}

/** A photograph with text laid over its lower third. */
export function PhotoOverlay({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <>
      <span aria-hidden="true" className="photo-scrim" />
      <div className={cn('absolute inset-x-0 bottom-0 p-5 text-white', className)}>{children}</div>
    </>
  );
}
