import { requireMySpace } from '@/lib/couple/guard';
import { listCoupleFirsts, signMediaByIds } from '@/lib/data/couple-space';
import { mergeFirsts } from '@/lib/couple/firsts';
import { AppHeader } from '@/components/nav/AppHeader';
import { FirstsRoom } from '@/components/couple/FirstsRoom';

export const dynamic = 'force-dynamic';

/**
 * The firsts.
 *
 * All nine cards, always, filled or not. The empty ones are the feature: a card
 * that asks "who said it first?" gets an answer, and a page that only showed
 * what somebody already remembered to add never would.
 */
export default async function CoupleFirstsPage() {
  const mine = await requireMySpace();
  const saved = await listCoupleFirsts(mine.space.id);
  const urls = await signMediaByIds(saved.map((first) => first.media_id));

  return (
    <>
      <AppHeader title="Анхны мөчүүд" backHref="/us" />
      <main id="main" className="px-4 pb-10">
        <FirstsRoom
          spaceId={mine.space.id}
          cards={mergeFirsts(saved).map((card) => ({
            key: card.key,
            label: card.label,
            prompt: card.prompt,
            happenedOn: card.entry?.happened_on ?? null,
            story: card.entry?.story ?? null,
            imageUrl: card.entry?.media_id ? urls.get(card.entry.media_id) ?? null : null,
          }))}
        />
      </main>
    </>
  );
}
