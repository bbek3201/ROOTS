'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import type { MemoryType } from '@/types/database';

/**
 * Type and text filters for the archive.
 *
 * Filters live in the URL rather than in component state, so a family member
 * can send "the photos" to a relative as a link and it opens the same view.
 */
export function MemoryFilterBar({
  types,
  activeType,
  query,
}: {
  types: Array<{ value: MemoryType; label: string }>;
  activeType: MemoryType | null;
  query: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();

  const apply = (next: { type?: string | null; q?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, entry] of Object.entries(next)) {
      if (entry === null || entry === '') params.delete(key);
      else if (entry !== undefined) params.set(key, entry);
    }
    startTransition(() => router.replace(`/memories?${params.toString()}`));
  };

  return (
    <div className={cn('space-y-2.5', pending && 'opacity-70')}>
      <form
        onSubmit={(event) => { event.preventDefault(); apply({ q: value.trim() || null }); }}
        role="search"
      >
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Дурсамжаас хайх…"
          aria-label="Дурсамжаас хайх"
          className="min-h-11 w-full rounded-full border border-line bg-surface px-4 text-[16px] text-ink placeholder:text-muted/70 focus:border-ember focus:outline-none"
        />
      </form>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        <FilterChip active={activeType === null} onClick={() => apply({ type: null })}>
          Бүгд
        </FilterChip>
        {types.map((type) => (
          <FilterChip
            key={type.value}
            active={activeType === type.value}
            onClick={() => apply({ type: activeType === type.value ? null : type.value })}
          >
            {type.label}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active ? 'border-ember bg-ember text-white' : 'border-line bg-surface text-ink-soft',
      )}
    >
      {children}
    </button>
  );
}
