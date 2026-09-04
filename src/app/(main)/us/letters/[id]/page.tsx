import { notFound } from 'next/navigation';
import { requireMySpace } from '@/lib/couple/guard';
import { getCoupleLetter } from '@/lib/data/couple-space';
import { AppHeader } from '@/components/nav/AppHeader';
import { LetterReader } from '@/components/couple/LetterReader';

export const dynamic = 'force-dynamic';

/**
 * Reading a letter.
 *
 * The page never decides whether the reader is allowed to see the body. It asks
 * the database, and the database either returns the body row or does not — a
 * check written here could be skipped by the next caller, and the policy cannot.
 */
export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mine = await requireMySpace();

  const letter = await getCoupleLetter(id);
  if (!letter || letter.space_id !== mine.space.id) notFound();

  return (
    <>
      <AppHeader title={letter.title} backHref="/us/letters" />
      <main id="main" className="px-4 pb-10">
        <LetterReader
          id={letter.id}
          title={letter.title}
          body={letter.body}
          unlockAt={letter.unlock_at}
          createdAt={letter.created_at}
          mine={letter.sender_id === mine.meUserId}
        />
      </main>
    </>
  );
}
