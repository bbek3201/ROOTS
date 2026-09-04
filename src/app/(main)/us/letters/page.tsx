import { requireMySpace } from '@/lib/couple/guard';
import { listCoupleLetters } from '@/lib/data/couple-space';
import { AppHeader } from '@/components/nav/AppHeader';
import { LetterList } from '@/components/couple/LetterList';

export const dynamic = 'force-dynamic';

export default async function CoupleLettersPage() {
  const mine = await requireMySpace();
  const letters = await listCoupleLetters(mine.space.id);

  return (
    <>
      <AppHeader title="Захидал" backHref="/us" />
      <main id="main" className="px-4 pb-10">
        <LetterList
          letters={letters.map((letter) => ({
            id: letter.id,
            title: letter.title,
            createdAt: letter.created_at,
            unlockAt: letter.unlock_at,
            mine: letter.sender_id === mine.meUserId,
            // The body is present only when the database decided it may be —
            // its absence IS the seal, not a flag the page chose to respect.
            sealed: letter.body === null,
            unread: letter.sender_id !== mine.meUserId && letter.read_at === null,
          }))}
        />
      </main>
    </>
  );
}
