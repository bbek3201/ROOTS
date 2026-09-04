import { requireMySpace } from '@/lib/couple/guard';
import { AppHeader } from '@/components/nav/AppHeader';
import { NewFutureMessageForm } from '@/components/couple/NewFutureMessageForm';

export const dynamic = 'force-dynamic';

export default async function NewFutureMessagePage() {
  const mine = await requireMySpace();

  return (
    <>
      <AppHeader title="Ирээдүйд захиа" backHref="/us/future" />
      <main id="main" className="px-4 pb-10">
        <NewFutureMessageForm
          spaceId={mine.space.id}
          startedOn={mine.space.started_on}
        />
      </main>
    </>
  );
}
