import { requireMySpace } from '@/lib/couple/guard';
import { AppHeader } from '@/components/nav/AppHeader';
import { NewLetterForm } from '@/components/couple/NewLetterForm';
import { displayName } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function NewLetterPage() {
  const mine = await requireMySpace();

  // Whichever partner is not the signed-in one.
  const recipient = mine.partners.find((person) => person.id !== mine.myPersonId);

  return (
    <>
      <AppHeader title="Захидал бичих" backHref="/us/letters" />
      <main id="main" className="px-4 pb-10">
        <NewLetterForm
          spaceId={mine.space.id}
          recipientName={recipient ? displayName(recipient) : 'Танай хүн'}
        />
      </main>
    </>
  );
}
