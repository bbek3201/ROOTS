'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/States';
import { searchEntries, yearsPresent, type SearchableEntry } from '@/lib/couple/search';
import { formatDate } from '@/lib/format';

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
 * the primary experience here and two columns is what keeps a face large enough
 * to recognise at arm's length.
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
        icon="❤️"
        title="Танай түүх эндээс эхэлнэ."
        description="Хамтдаа авахуулсан эхний зургаа хадгалаарай."
        action={{ label: 'Эхний дурсамжаа нэмэх', href: '/us/memories/new' }}
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Гарчиг, газар, түүхээр хайх"
          aria-label="Дурсамж хайх"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted"
        />
        <Link
          href="/us/memories/new"
          className="flex min-h-11 shrink-0 items-center rounded-xl bg-forest px-4 text-sm font-medium text-forest-ink"
        >
          Нэмэх
        </Link>
      </div>

      {years.length > 1 ? (
        <ul className="mb-4 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
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
        <p className="py-10 text-center text-sm text-muted">Тохирох дурсамж олдсонгүй.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((memory) => (
            <li key={memory.id}>
              <Link href={`/us/memories/${memory.id}`} className="group block">
                <span className="relative block aspect-square overflow-hidden rounded-2xl border border-line bg-parchment-deep">
                  {memory.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URL, expires.
                    <img
                      src={memory.cover}
                      alt={memory.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-2xl opacity-40">❤</span>
                  )}
                  {memory.photoCount + memory.videoCount > 1 ? (
                    <span className="absolute right-1.5 top-1.5 rounded-pill bg-ink/70 px-1.5 py-0.5 text-[0.6rem] text-white">
                      {memory.photoCount + memory.videoCount}
                    </span>
                  ) : null}
                </span>
                <span className="mt-2 block truncate text-sm font-medium text-ink">{memory.title}</span>
                <span className="block truncate text-xs text-muted">
                  {[memory.date ? formatDate(memory.date, 'exact') : null, memory.place]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
