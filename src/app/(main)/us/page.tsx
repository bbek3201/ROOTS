import { redirect } from 'next/navigation';
import { requireActiveFamily } from '@/lib/family-context';
import { getMyCoupleSpace } from '@/lib/couple/space';
import {
  coupleCounts, listCoupleFirsts, listCoupleMemories, signCoupleMedia,
} from '@/lib/data/couple-space';
import { firstsProgress } from '@/lib/couple/firsts';
import { CoupleHome } from '@/components/couple/CoupleHome';
import { displayName } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * The couple space — data only.
 *
 * Same split as the family home: this reads, <CoupleHome> renders. The space is
 * resolved from the signed-in user rather than from a URL, because there is no
 * id a person could type here that would be theirs and no id that would be
 * anyone else's — a couple space belongs to whoever is looking at it, or to
 * nobody.
 */
export default async function CoupleSpacePage() {
  await requireActiveFamily();

  const mine = await getMyCoupleSpace();
  // No space yet: the first thing to do is make one, not look at an empty one.
  if (!mine) redirect('/us/start');

  const [counts, memories, firsts] = await Promise.all([
    coupleCounts(mine.space.id),
    listCoupleMemories(mine.space.id),
    listCoupleFirsts(mine.space.id),
  ]);

  // The most recent photographs, which is what the space should open on.
  const covers = memories
    .flatMap((memory) => memory.media.filter((item) => item.kind === 'photo').slice(0, 1))
    .slice(0, 6);
  const urls = await signCoupleMedia(covers);

  const [a, b] = mine.partners;

  return (
    <CoupleHome
      spaceId={mine.space.id}
      names={[displayName(a), b ? displayName(b) : 'Танай хүн']}
      startedOn={mine.space.started_on}
      howWeMet={mine.space.how_we_met}
      partnerJoined={mine.partnerJoined}
      counts={counts}
      firsts={firstsProgress(firsts)}
      covers={covers.map((item) => ({
        id: item.id,
        src: urls.get(item.storage_path) ?? null,
        alt: item.caption ?? '',
      }))}
    />
  );
}
