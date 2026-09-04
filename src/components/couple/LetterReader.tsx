'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { LockIcon } from '@/components/icons';
import { formatDate } from '@/lib/format';

/**
 * Reading a letter, or waiting for one.
 *
 * `body` is null when the database declined to return it — this component never
 * receives sealed text and then hides it, which is why there is nothing here to
 * reveal with a developer console, a view-source, or a saved HTML page.
 */
export function LetterReader({
  id,
  title,
  body,
  unlockAt,
  createdAt,
  mine,
  imageUrl,
}: {
  id: string;
  title: string;
  body: string | null;
  unlockAt: string | null;
  createdAt: string;
  mine: boolean;
  imageUrl: string | null;
}) {
  // Reading it marks it read, once, and only for the recipient — the RPC
  // ignores the writer re-reading their own letter.
  useEffect(() => {
    if (body === null || mine) return;
    const supabase = createClient();
    void supabase.rpc('mark_letter_read', { p_id: id });
  }, [id, body, mine]);

  if (body === null) {
    return (
      <Card className="border-dashed py-16 text-center">
        <LockIcon size={30} className="mx-auto text-muted" />
        <h1 className="ed-display mt-6 text-2xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted">
          {unlockAt
            ? `Энэ захидал ${formatDate(unlockAt.slice(0, 10), 'exact')}-нд нээгдэнэ.`
            : 'Энэ захидал одоохондоо битүүмжлэгдсэн байна.'}
        </p>
      </Card>
    );
  }

  return (
    <article>
      <p className="eyebrow">{mine ? 'Таны бичсэн' : 'Танд'}</p>
      <h1 className="ed-display ed-display-lg mt-4 text-balance">{title}</h1>
      <p className="mt-3 text-sm text-muted">{formatDate(createdAt.slice(0, 10), 'exact')}</p>

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
        <img
          src={imageUrl}
          alt=""
          className="mt-6 w-full rounded-2xl border border-line object-cover"
        />
      ) : null}

      {/* A letter is read, not scanned. The measure is the point: 62 characters
          is where a line stops needing the eye to hunt for the next one. */}
      <div className="measure mt-9 whitespace-pre-wrap text-[1.12rem] leading-[1.9] text-ink">
        {body}
      </div>
    </article>
  );
}
