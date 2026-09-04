import { redirect } from 'next/navigation';
import { requireActiveFamily } from '@/lib/family-context';
import { getMyCoupleSpace, myCouples } from '@/lib/couple/space';
import { CoupleOnboarding } from '@/components/couple/CoupleOnboarding';
import { displayName, lifespan } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Opening a space.
 *
 * The only couples offered are the ones the signed-in member is personally in.
 * That is not a UI convenience — create_couple_space refuses everything else at
 * the database, and offering a choice that will be rejected is worse than
 * offering none.
 */
export default async function CoupleStartPage() {
  const membership = await requireActiveFamily();

  const existing = await getMyCoupleSpace();
  if (existing) redirect('/us');

  const couples = await myCouples(membership.family_id);

  return (
    <CoupleOnboarding
      // A relationship already recorded in the tree is the starting point. One
      // that is not there yet has to be added to the tree first: the couple
      // space is an annex to a real couple, not a second place to declare one.
      couples={couples.map((couple) => ({
        id: couple.id,
        partnerName: couple.partner ? displayName(couple.partner) : 'Тодорхойгүй',
        partnerYears: couple.partner ? lifespan(couple.partner) : '',
        suggestedStart: couple.relationshipStart ?? couple.marriageDate ?? null,
        taken: couple.hasSpace,
      }))}
    />
  );
}
