import { notFound } from 'next/navigation';
import { requireMySpace } from '@/lib/couple/guard';
import { getCoupleMemory, signCoupleMedia } from '@/lib/data/couple-space';
import { AppHeader } from '@/components/nav/AppHeader';
import { CoupleMemoryDetail } from '@/components/couple/CoupleMemoryDetail';

export const dynamic = 'force-dynamic';

/**
 * One moment, large.
 *
 * No comments and no reactions, on purpose. Two people do not need a comment
 * thread to talk to each other, and the moment a memory has a like count it
 * starts being posted rather than kept.
 */
export default async function CoupleMemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mine = await requireMySpace();

  const memory = await getCoupleMemory(id);
  // RLS returns nothing for another space's memory, so this is both "not
  // yours" and "does not exist" — identical either way.
  if (!memory || memory.space_id !== mine.space.id) notFound();

  const urls = await signCoupleMedia(memory.media);

  return (
    <>
      <AppHeader title={memory.title} backHref="/us/memories" />
      <main id="main" className="px-4 pb-10">
        <CoupleMemoryDetail
          title={memory.title}
          description={memory.description}
          date={memory.memory_date}
          place={memory.place_label}
          mood={memory.mood}
          media={memory.media.map((item) => ({
            id: item.id,
            kind: item.kind,
            url: urls.get(item.storage_path) ?? null,
            caption: item.caption,
          }))}
        />
      </main>
    </>
  );
}
