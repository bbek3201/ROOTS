'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plate } from '@/components/home/Plate';
import { EmptyState } from '@/components/ui/States';
import { SearchIcon } from '@/components/icons';
import { searchEntries, yearsPresent, type SearchableEntry } from '@/lib/couple/search';
import { formatDateShort } from '@/lib/format';

export interface GalleryMemory {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  place: string | null;
  mood: string | null;
  photoCount: number;
  videoCount: number;
  cover: string | null;
}

/**
 * The gallery, with search that runs where the memories already are.
 *
 * Two columns on a phone, three on a tablet, four on a desktop — the phone is
 * the primary experience and two columns is what keeps a face large enough to
 * recognise at arm's length.
 *
 * The plates are 4:5, not square. A square crop is the shape of a feed and it
 * cuts the top off everyone standing up; 4:5 is the shape of a print, and it is
 * the difference between an archive and an account.
 */
export function MemoryGallery({ memories }: { memories: GalleryMemory[] }) {
  const [query, setQuery] = useState('');
  const [year, setYear] = useState<number | null>(null);

  const searchable: SearchableEntry[] = useMemo(
    () =>
      memories.map((memory) => ({
        id: memory.id,
        kind: 'memory' as const,
        title: memory.title,
        description: memory.description,
        place: memory.place,
        mood: memory.mood,
        date: memory.date,
      })),
    [memories],
  );

  const years = useMemo(() => yearsPresent(searchable), [searchable]);

  const visible = useMemo(() => {
    const matches = new Set(searchEntries(searchable, { query, year }).map((entry) => entry.id));
    return memories.filter((memory) => matches.has(memory.id));
  }, [memories, searchable, query, year]);

  if (memories.length === 0) {
    return (
      <EmptyState
        title="Танай түүх эндээс эхэлнэ."
        description="Хамтдаа авахуулсан эхний зургаа хадгалаарай."
        action={{ label: 'Эхний дурсамжаа нэмэх', href: '/us/memories/new' }}
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex gap-2.5">
        <div className="relative min-w-0 flex-1">
          <SearchIcon
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Гарчиг, газар, түүхээр хайх"
            aria-label="Дурсамж хайх"
            className="min-h-11 w-full rounded-pill border border-line bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-muted"
          />
        </div>
        <Link
          href="/us/memories/new"
          className="flex min-h-11 shrink-0 items-center rounded-pill bg-forest px-5 text-sm font-medium text-forest-ink"
        >
          Нэмэх
        </Link>
      </div>

      {years.length > 1 ? (
        <ul className="mb-6 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <li>
            <button
              type="button"
              onClick={() => setYear(null)}
              aria-pressed={year === null}
              className={`rounded-pill px-3 py-1.5 text-xs ${
                year === null ? 'bg-forest text-forest-ink' : 'border border-line text-ink-soft'
              }`}
            >
              Бүгд
            </button>
          </li>
          {years.map((option) => (
            <li key={option}>
              <button
                type="button"
                onClick={() => setYear(option === year ? null : option)}
                aria-pressed={year === option}
                className={`rounded-pill px-3 py-1.5 text-xs ${
                  year === option ? 'bg-forest text-forest-ink' : 'border border-line text-ink-soft'
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">Тохирох дурсамж олдсонгүй.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
          {visible.map((memory) => {
            const sheets = memory.photoCount + memory.videoCount;
            return (
              <li key={memory.id}>
                <Link href={`/us/memories/${memory.id}`} className="group block">
                  <Plate
                    src={memory.cover}
                    alt={memory.title}
                    initial={memory.title.slice(0, 1)}
                    className="aspect-4/5"
                  >
                    {/* How many sheets are behind this one. Set as a whisper in
                        the corner of the print rather than as a badge — this is
                        a caption, not a notification. */}
                    {sheets > 1 ? (
                      <span className="absolute right-3 top-3 rounded-pill bg-[rgb(12_28_23/0.55)] px-2 py-0.5 text-[0.65rem] tabular-nums text-white/90">
                        {sheets}
                      </span>
                    ) : null}
                  </Plate>

                  <p className="mt-3.5 text-[1.02rem] font-medium leading-snug tracking-[-0.02em] text-ink group-hover:underline decoration-1 underline-offset-4">
                    {memory.title}
                  </p>
                  <p className="mt-1 truncate text-[0.8rem] tracking-[0.06em] text-muted">
                    {[memory.date ? formatDateShort(memory.date) : null, memory.place]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
