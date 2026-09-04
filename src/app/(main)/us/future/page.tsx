import { requireMySpace } from '@/lib/couple/guard';
import { listFutureMessages } from '@/lib/data/couple-space';
import { AppHeader } from '@/components/nav/AppHeader';
import { FutureRoom } from '@/components/couple/FutureRoom';

export const dynamic = 'force-dynamic';

/**
 * Messages to their future selves.
 *
 * A locked message arrives here with its title, its date and no body at all —
 * not a body the page declines to render. The database returns no row for a
 * sealed message's contents, so there is nothing in this process to leak, in a
 * log, in a cache, or in an HTML comment.
 */
export default async function CoupleFuturePage() {
  const mine = await requireMySpace();
  const messages = await listFutureMessages(mine.space.id);

  return (
    <>
      <AppHeader title="Ирээдүйд" backHref="/us" />
      <main id="main" className="px-4 pb-10">
        <FutureRoom
          messages={messages.map((message) => ({
            id: message.id,
            title: message.title,
            unlockAt: message.unlock_at,
            body: message.body,
            openedAt: message.opened_at,
          }))}
        />
      </main>
    </>
  );
}
