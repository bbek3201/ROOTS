import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

/**
 * A photographic plate.
 *
 * The album's own picture element, separate from the app's `Photo`: it carries
 * the large editorial radius, and it puts its caption INSIDE the picture in a
 * whisper — a year, a place, a name — instead of turning every photograph into
 * a card with a title and a chevron under it.
 *
 * Half of any real family archive has no scan yet, so the empty plate is a
 * first-class state: warm cream and sage with the initial set large, holding
 * exactly the space the photograph will take the day someone finds it.
 *
 * Storage links are short-lived signed URLs, which is why this is a plain <img>
 * and not next/image — the optimiser would cache a URL that expires.
 */
export function Plate({
  src,
  alt,
  initial,
  caption,
  meta,
  className,
  imgClassName,
  priority = false,
  children,
}: {
  src?: string | null;
  alt: string;
  initial?: string;
  /** The line read first — a title, a name. */
  caption?: string;
  /** The line under it — a year, a place. */
  meta?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cn('ed-frame group', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL, see above.
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : undefined}
          className={cn(
            'h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]',
            imgClassName,
          )}
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center font-display text-[clamp(2rem,16cqw,6rem)] text-[color-mix(in_srgb,#183b32_22%,transparent)]"
          style={{ containerType: 'inline-size' }}
        >
          {initial ?? ''}
        </span>
      )}

      {caption || meta ? (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[rgb(12_28_23/0.62)] via-[rgb(12_28_23/0.18)] to-transparent"
          />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
            {caption ? (
              <p className="text-[1.05rem] font-medium leading-snug tracking-[-0.02em] text-white/95 sm:text-[1.2rem]">{caption}</p>
            ) : null}
            {meta ? (
              <p className="mt-1 text-[0.78rem] tracking-[0.14em] text-white/70 uppercase">{meta}</p>
            ) : null}
          </div>
        </>
      ) : null}

      {children}
    </div>
  );
}
