'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { AssistantPanel } from './AssistantPanel';
import { SearchIcon } from '@/components/icons';
import { yearOf } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Result {
  result_type: string;
  result_id: string;
  title: string;
  subtitle: string | null;
  snippet: string | null;
  event_date: string | null;
  rank: number;
}

/**
 * Search, with the family assistant beside it.
 *
 * Two different questions live on this screen and they are kept visibly apart:
 *   · "find the thing that says X"    → full-text search over the archive
 *   · "who was my mother's father?"   → the relationship graph
 * Mixing them into one box would make the second one look like a lucky guess
 * rather than an answer the database can prove.
 */
export function SearchScreen({
  query,
  results,
  hasSelfLink,
}: {
  query: string;
  results: Result[];
  hasSelfLink: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [tab, setTab] = useState<'search' | 'ask'>('search');
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(() => {
      router.replace(value.trim() ? `/search?q=${encodeURIComponent(value.trim())}` : '/search');
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5" role="tablist" aria-label="Хайлтын горим">
        <TabButton active={tab === 'search'} onClick={() => setTab('search')}>Архиваас хайх</TabButton>
        <TabButton active={tab === 'ask'} onClick={() => setTab('ask')}>Асуулт асуух</TabButton>
      </div>

      {tab === 'search' ? (
        <>
          <form onSubmit={submit} role="search">
            <input
              type="search"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Нэр, дурсамж, ярианы бичвэрээс хайх…"
              aria-label="Архиваас хайх"
              autoFocus
              className="min-h-12 w-full rounded-full border border-line bg-surface px-4 text-[16px] text-ink placeholder:text-muted/70 focus:border-ember focus:outline-none"
            />
          </form>

          {!query ? (
            <EmptyState
              icon={<SearchIcon size={30} />}
              title="Юу хайх вэ?"
              description="Хүний нэр, дурсамжийн гарчиг, ярианы бичвэр, уншуулсан баримтын доторх үгээр хайж болно."
            />
          ) : results.length === 0 ? (
            <EmptyState
              title={`«${query}» олдсонгүй`}
              description="Өөр үгээр эсвэл нэрийн эхний хэсгээр хайж үзнэ үү."
            />
          ) : (
            <ul className={cn('space-y-2.5', pending && 'opacity-60')}>
              {results.map((result) => (
                <li key={`${result.result_type}:${result.result_id}`}>
                  <Link href={hrefFor(result)} className="card block p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-ink">{result.title || 'Гарчиггүй'}</p>
                      <Badge tone={toneFor(result.result_type)}>{typeLabel(result.result_type)}</Badge>
                    </div>
                    {result.subtitle ? (
                      <p className="mt-0.5 text-sm text-muted">{result.subtitle}</p>
                    ) : null}
                    {result.snippet ? (
                      <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{result.snippet}</p>
                    ) : null}
                    {result.event_date ? (
                      <p className="mt-1.5 text-xs text-gold">{yearOf(result.event_date)}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {!hasSelfLink ? (
            <Card className="border-gold/30 bg-gold-wash">
              <p className="text-sm leading-relaxed text-ink-soft">
                «Аав минь хэн бэ?» гэх мэт асуултад хариулахын тулд та өөрийгөө гэр бүлийн модны
                аль хүн болохыг Профайл хэсгээс сонгоно уу.
              </p>
              <Link href="/profile" className="mt-2 inline-block text-sm font-medium text-ember">
                Профайл руу очих →
              </Link>
            </Card>
          ) : null}
          <AssistantPanel />
        </>
      )}
    </div>
  );
}

function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-pill border px-4 py-2.5 text-sm font-medium transition-colors',
        active ? 'border-ember bg-ember text-white' : 'border-line bg-surface text-ink-soft',
      )}
    >
      {children}
    </button>
  );
}

function hrefFor(result: Result): string {
  switch (result.result_type) {
    case 'person': return `/person/${result.result_id}`;
    case 'memory': return `/memories/${result.result_id}`;
    case 'transcript': return `/interview`;
    default: return `/memories`;
  }
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    person: 'Хүн', memory: 'Дурсамж', transcript: 'Ярилцлага', document: 'Баримт',
  };
  return labels[type] ?? type;
}

function toneFor(type: string): 'neutral' | 'ember' | 'gold' | 'sage' {
  switch (type) {
    case 'person': return 'sage';
    case 'memory': return 'gold';
    case 'transcript': return 'ember';
    default: return 'neutral';
  }
}
