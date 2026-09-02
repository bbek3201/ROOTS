import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { listMemories } from '@/lib/data/memories';
import { getSignedUrls } from '@/lib/media/storage';
import { AppHeader } from '@/components/nav/AppHeader';
import { EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { ArchiveIcon, PlusIcon } from '@/components/icons';
import { formatDate } from '@/lib/format';
import { MemoryFilterBar } from '@/components/memories/MemoryFilterBar';
import type { MemoryType } from '@/types/database';

export const dynamic = 'force-dynamic';

const MEMORY_TYPES: Array<{ value: MemoryType; label: string }> = [
  { value: 'story', label: 'Түүх' },
  { value: 'photo', label: 'Зураг' },
  { value: 'audio', label: 'Дуу хоолой' },
  { value: 'video', label: 'Видео' },
  { value: 'letter', label: 'Захидал' },
  { value: 'document', label: 'Баримт' },
  { value: 'recipe', label: 'Хоолны жор' },
  { value: 'tradition', label: 'Уламжлал' },
];

export default async function MemoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const membership = await requireActiveFamily();
  const { type, q } = await searchParams;

  const validType = MEMORY_TYPES.find((entry) => entry.value === type)?.value;

  const { memories, count } = await listMemories(membership.family_id, {
    ...(validType ? { type: validType } : {}),
    ...(q ? { search: q } : {}),
    limit: 40,
  });

  // Cover images for the cards, signed in one batch.
  const coverPaths = memories.flatMap((memory) => {
    const media = (memory as unknown as { media?: Array<{ kind: string; storage_path: string; variant: string }> }).media ?? [];
    const cover = media.find((item) => item.kind === 'photo' && item.variant === 'original');
    return cover ? [cover.storage_path] : [];
  });
  const coverUrls = await getSignedUrls(coverPaths);

  return (
    <>
      <AppHeader
        title="Дурсамжийн архив"
        subtitle={`${count} дурсамж`}
        action={
          <Link
            href="/memories/new"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-ember text-white"
            aria-label="Дурсамж нэмэх"
          >
            <PlusIcon size={19} />
          </Link>
        }
      />

      <main id="main" className="px-4 pb-8 pt-4">
        <MemoryFilterBar types={MEMORY_TYPES} activeType={validType ?? null} query={q ?? ''} />

        {memories.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<ArchiveIcon size={32} />}
            title={q || validType ? 'Илэрц олдсонгүй' : 'Архив хоосон байна'}
            description={
              q || validType
                ? 'Өөр түлхүүр үг эсвэл төрлөөр хайж үзнэ үү.'
                : 'Хуучин зураг, захидал, дуу хоолой, ярьж өгсөн түүх — юу ч байсан үнэ цэнэтэй. Эхнийхээ оруулаад эхэлье.'
            }
            action={{ label: 'Дурсамж нэмэх', href: '/memories/new' }}
          />
        ) : (
          <ul className="mt-4 space-y-3">
            {memories.map((memory) => {
              const media = (memory as unknown as {
                media?: Array<{ kind: string; storage_path: string; variant: string }>;
              }).media ?? [];
              const cover = media.find((item) => item.kind === 'photo' && item.variant === 'original');
              const coverUrl = cover ? coverUrls.get(cover.storage_path) : null;

              return (
                <li key={memory.id}>
                  <Link href={`/memories/${memory.id}`} className="card block overflow-hidden p-0">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverUrl}
                        alt=""
                        loading="lazy"
                        className="h-44 w-full object-cover"
                      />
                    ) : null}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-display text-base leading-snug text-ink">{memory.title}</h2>
                        <Badge tone="gold">{typeLabel(memory.type)}</Badge>
                      </div>
                      {memory.description || memory.body ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted">
                          {memory.description ?? memory.body}
                        </p>
                      ) : null}
                      <p className="mt-2.5 text-xs text-muted">
                        {memory.contributor_name} нэмсэн
                        {memory.memory_date
                          ? ` · ${formatDate(memory.memory_date, memory.date_precision, membership.family.default_locale)}`
                          : ''}
                        {media.length > 0 ? ` · ${media.length} файл` : ''}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

function typeLabel(type: string): string {
  return MEMORY_TYPES.find((entry) => entry.value === type)?.label ?? 'Дурсамж';
}
