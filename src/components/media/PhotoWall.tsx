'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { yearOf } from '@/lib/format';

interface Photo {
  id: string;
  url: string | null;
  caption: string | null;
  variant: string;
  takenAt: string | null;
}

/**
 * The photo grid, with a full-screen viewer.
 *
 * Derived versions (restored, colourised) are labelled in the viewer so nobody
 * mistakes an enhanced image for the original print. The original is always
 * still in the archive alongside it.
 */
export function PhotoWall({ photos }: { photos: Photo[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenIndex(null);
      if (event.key === 'ArrowRight') setOpenIndex((i) => (i === null ? null : Math.min(i + 1, photos.length - 1)));
      if (event.key === 'ArrowLeft') setOpenIndex((i) => (i === null ? null : Math.max(i - 1, 0)));
    };
    window.addEventListener('keydown', onKey);
    // Stop the page behind the viewer from scrolling under the finger.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, photos.length]);

  const open = openIndex !== null ? photos[openIndex] : null;

  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5">
        {photos.map((photo, position) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(position)}
              className="relative block aspect-square w-full overflow-hidden rounded-xl border border-line bg-parchment-deep"
              aria-label={photo.caption ?? 'Зураг харах'}
            >
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt={photo.caption ?? ''}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-xs text-muted">
                  Ачаалж чадсангүй
                </span>
              )}
              {photo.variant !== 'original' ? (
                <span className="absolute bottom-1 left-1 rounded-pill bg-ink/70 px-1.5 py-0.5 text-[0.6rem] text-white">
                  Сэргээсэн
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.caption ?? 'Зураг'}
          className="fixed inset-0 z-50 flex flex-col bg-ink/95"
          onClick={() => setOpenIndex(null)}
        >
          <div className="flex justify-end p-3">
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              className="h-11 w-11 rounded-full bg-white/10 text-white"
              aria-label="Хаах"
            >
              ✕
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-3">
            {open.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={open.url}
                alt={open.caption ?? ''}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            ) : null}
          </div>

          <div className="px-5 pb-8 pt-4 text-center text-white/85" onClick={(event) => event.stopPropagation()}>
            {open.caption ? <p className="text-sm">{open.caption}</p> : null}
            <p className="mt-1.5 flex items-center justify-center gap-2 text-xs text-white/60">
              {yearOf(open.takenAt) ? <span>{yearOf(open.takenAt)}</span> : null}
              {open.variant === 'original' ? (
                <Badge tone="sage">Эх хувь</Badge>
              ) : (
                <Badge tone="ember">Сэргээсэн хувилбар · эх хувь архивт хэвээр</Badge>
              )}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
