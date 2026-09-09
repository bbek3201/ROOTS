'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/format';

export interface DetailMedia {
  id: string;
  kind: string;
  url: string | null;
  caption: string | null;
}

/**
 * One moment, large.
 *
 * The photograph comes first and fills the width; the words sit under it. No
 * reactions, no comments, no share button — two people do not need a comment
 * thread to talk to each other, and a like count turns a memory into a post.
 */
export function CoupleMemoryDetail({
  title,
  description,
  date,
  place,
  mood,
  media,
}: {
  title: string;
  description: string | null;
  date: string | null;
  place: string | null;
  mood: string | null;
  media: DetailMedia[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const photos = media.filter((item) => item.kind === 'photo');
  const videos = media.filter((item) => item.kind === 'video');
  const open = openIndex !== null ? photos[openIndex] : null;

  return (
    <article>
      {photos[0]?.url ? (
        <button
          type="button"
          onClick={() => setOpenIndex(0)}
          className="block w-full overflow-hidden rounded-2xl border border-line bg-parchment-deep"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, expires. */}
          <img src={photos[0].url} alt={title} className="w-full object-cover" />
        </button>
      ) : null}

      <header className="mt-5">
        <h1 className="ed-display ed-display-lg text-balance">{title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          {date ? <span>{formatDate(date, 'exact')}</span> : null}
          {place ? <span>· {place}</span> : null}
          {mood ? <Badge tone="sage">{mood}</Badge> : null}
        </p>
      </header>

      {description ? (
        <p className="mt-5 whitespace-pre-wrap text-[1.05rem] leading-relaxed text-ink">{description}</p>
      ) : null}

      {photos.length > 1 ? (
        <ul className="mt-6 grid grid-cols-3 gap-1.5">
          {photos.slice(1).map((photo, position) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setOpenIndex(position + 1)}
                className="block aspect-square w-full overflow-hidden rounded-xl border border-line bg-parchment-deep"
              >
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
                  <img src={photo.url} alt={photo.caption ?? ''} loading="lazy" className="h-full w-full object-cover" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {videos.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {videos.map((video) => (
            <li key={video.id}>
              {video.url ? (
                /* A family's own recording; a caption track is neither available nor meaningful here. */
                <video src={video.url} controls playsInline className="w-full rounded-2xl border border-line" />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.caption ?? title}
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
          <div className="flex min-h-0 flex-1 items-center justify-center px-3 pb-10">
            {open.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
              <img src={open.url} alt={open.caption ?? ''} className="max-h-full max-w-full rounded-lg object-contain" />
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
