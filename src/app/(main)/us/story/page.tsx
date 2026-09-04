import { requireMySpace } from '@/lib/couple/guard';
import { AppHeader } from '@/components/nav/AppHeader';
import { StoryEditor } from '@/components/couple/StoryEditor';

export const dynamic = 'force-dynamic';

export default async function CoupleStoryPage() {
  const mine = await requireMySpace();

  return (
    <>
      <AppHeader title="Бидний түүх" backHref="/us" />
      <main id="main" className="px-4 pb-10">
        <StoryEditor
          spaceId={mine.space.id}
          howWeMet={mine.space.how_we_met ?? ''}
          startedOn={mine.space.started_on ?? ''}
        />
      </main>
    </>
  );
}
