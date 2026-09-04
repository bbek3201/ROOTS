import { requireMySpace } from '@/lib/couple/guard';
import { listCoupleMemories, signCoupleMedia } from '@/lib/data/couple-space';
import { AppHeader } from '@/components/nav/AppHeader';
import { MemoryGallery } from '@/components/couple/MemoryGallery';

export const dynamic = 'force-dynamic';

/**
 * Everything they have kept, newest first.
 *
 * Search and filtering run in the browser over the rows loaded here rather than
 * as queries: a couple's archive is hundreds of items, not the family's tens of
 * thousands, so typing can feel instant and nothing leaves the device to find a
 * memory again.
 */
export default async function CoupleMemoriesPage() {
  const mine = await requireMySpace();
  const memories = await listCoupleMemories(mine.space.id);

  const urls = await signCoupleMedia(memories.flatMap((memory) => memory.media));

  return (
    <>
      <AppHeader
        title="Дурсамж"
        subtitle={memories.length > 0 ? `${memories.length}` : undefined}
        backHref="/us"
      />
      <main id="main" className="px-4 pb-10">
        <MemoryGallery
          memories={memories.map((memory) => ({
            id: memory.id,
            title: memory.title,
            description: memory.description,
            date: memory.memory_date,
            place: memory.place_label,
            mood: memory.mood,
            photoCount: memory.media.filter((item) => item.kind === 'photo').length,
            videoCount: memory.media.filter((item) => item.kind === 'video').length,
            cover: memory.media[0]
              ? urls.get(memory.media[0].storage_path) ?? null
              : null,
          }))}
        />
      </main>
    </>
  );
}
