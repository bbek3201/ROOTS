import { AppHeader } from '@/components/nav/AppHeader';
import { MemoryGallery } from '@/components/couple/MemoryGallery';
import { MEMORIES } from '@/app/preview/fixture';

export default function PreviewMemories() {
  return (
    <div className="mx-auto w-full max-w-[860px] py-6 md:py-12">
      <AppHeader title="Дурсамж" subtitle={`${MEMORIES.length}`} backHref="/preview" />
      <main className="px-4 pb-10">
        <MemoryGallery memories={MEMORIES} />
      </main>
    </div>
  );
}
