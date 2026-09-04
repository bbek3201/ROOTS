import { requireMySpace } from '@/lib/couple/guard';
import { AppHeader } from '@/components/nav/AppHeader';
import { NewCoupleMemoryForm } from '@/components/couple/NewCoupleMemoryForm';

export const dynamic = 'force-dynamic';

export default async function NewCoupleMemoryPage() {
  const mine = await requireMySpace();

  return (
    <>
      <AppHeader title="Дурсамж нэмэх" backHref="/us/memories" />
      <main id="main" className="px-4 pb-10">
        <NewCoupleMemoryForm spaceId={mine.space.id} />
      </main>
    </>
  );
}
