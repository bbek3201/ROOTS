import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { listMemories } from '@/lib/data/memories';
import { getSignedUrls } from '@/lib/media/storage';
import { Photo, PhotoOverlay } from '@/components/ui/Photo';
import { Display, Eyebrow } from '@/components/ui/Editorial';
import { EmptyState } from '@/components/ui/States';
import { MemoryFilterBar } from '@/components/memories/MemoryFilterBar';
import { ArchiveIcon, PlusIcon } from '@/components/icons';
import { formatDate, yearOf } from '@/lib/format';
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

/**
 * The archive as a wall of photographs.
 *
 * Two columns of images, and memories that have no photograph yet take the same
 * slot as a quiet typographic tile rather than a card with an icon on it — the
 * grid stays a grid, and a written story is not made to look like a lesser kind
 * of memory than a picture.
 */
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

  const covers = new Map<string, string>();
  for (const memory of memories) {
    const media = (memory as unknown as {
      media?: Array<{ kind: string; storage_path: string; variant: string }>;
    }).media ?? [];
    const cover = media.find((item) => item.kind === 'photo' && item.variant === 'original');
    if (cover) covers.set(memory.id, cover.storage_path);
  }
  const urls = await getSignedUrls([...covers.values()]);

  return (
    <main id="main" className="px-5 pb-12 pt-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Eyebrow>{count} дурсамж</Eyebrow>
          <Display size="lg" className="mt-2">
            Дурсамжийн архив
          </Display>
        </div>
        <Link
          href="/memories/new"
          aria-label="Дурсамж нэмэх"
          className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-forest-ink shadow-(--shadow-green) transition-colors hover:bg-forest-soft"
        >
          <PlusIcon size={20} />
        </Link>
      </header>

      <MemoryFilterBar types={MEMORY_TYPES} activeType={validType ?? null} query={q ?? ''} />

      {memories.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<ArchiveIcon size={30} />}
          title={q || validType ? 'Илэрц олдсонгүй' : 'Архив хоосон байна'}
          description={
            q || validType
              ? 'Өөр түлхүүр үг эсвэл төрлөөр хайж үзнэ үү.'
              : 'Хуучин зураг, захидал, дуу хоолой, ярьж өгсөн түүх — юу ч байсан үнэ цэнэтэй. Эхнийхээ оруулаад эхэлье.'
          }
          action={{ label: 'Дурсамж нэмэх', href: '/memories/new' }}
        />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6">
          {memories.map((memory) => {
            const path = covers.get(memory.id);
            const url = path ? urls.get(path) : null;
            const year = memory.memory_date ? yearOf(memory.memory_date) : '';

            return (
              <Link key={memory.id} href={`/memories/${memory.id}`} className="group block">
                {url ? (
                  <Photo src={url} alt={memory.title} ratio="portrait">
                    <PhotoOverlay className="p-3">
                      <p className="truncate text-xs text-white/85">{year}</p>
                    </PhotoOverlay>
                  </Photo>
                ) : (
                  <div className="photo-frame aspect-4/5 flex items-end p-4">
                    <div>
                      <p className="eyebrow">{typeLabel(memory.type)}</p>
                      <p className="mt-2 line-clamp-4 font-display text-[1.05rem] leading-snug text-ink">
                        {memory.description ?? memory.body ?? memory.title}
                      </p>
                    </div>
                  </div>
                )}
                <p className="mt-2.5 line-clamp-2 text-[0.95rem] leading-snug text-ink">
                  {memory.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {memory.memory_date
                    ? formatDate(memory.memory_date, memory.date_precision, membership.family.default_locale)
                    : memory.contributor_name}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function typeLabel(type: string): string {
  return MEMORY_TYPES.find((entry) => entry.value === type)?.label ?? 'Дурсамж';
}
