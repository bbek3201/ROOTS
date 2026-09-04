import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { AccessError } from '@/lib/auth/guards';
import type { CoupleSpaceRow, PersonRow } from '@/types/database';

export interface CoupleSpace {
  space: CoupleSpaceRow;
  /** Both partners as the family tree knows them. */
  partners: PersonRow[];
  /** Has the second partner accepted yet? */
  partnerJoined: boolean;
  /** The signed-in half of the couple. */
  meUserId: string;
  myPersonId: string | null;
}

/**
 * The caller's own couple space, if they have one.
 *
 * Every read here goes through RLS as the signed-in user, and the policies on
 * couple_spaces grant only its two members — so this returns null for a family
 * admin, for a parent, and for anyone else who is not one of the two people.
 * There is no family_id filter written by hand that could be forgotten, because
 * membership is not a filter, it is the policy.
 */
export const getMyCoupleSpace = cache(async (): Promise<CoupleSpace | null> => {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  // RLS returns at most the caller's own spaces, so no filter is needed and
  // none is written: the query cannot be pointed at somebody else's.
  const { data: space } = await supabase
    .from('couple_spaces')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!space) return null;

  return hydrate(space, userId);
});

/** A specific space, refused unless the caller is in it. */
export async function requireCoupleSpace(spaceId: string): Promise<CoupleSpace> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new AccessError('Нэвтэрнэ үү.', 401);

  const { data: space } = await supabase
    .from('couple_spaces')
    .select('*')
    .eq('id', spaceId)
    .is('deleted_at', null)
    .maybeSingle();

  // Not a member and does not exist are the same answer on purpose. Telling
  // someone that a couple HAS a private space is already something.
  if (!space) throw new AccessError('Олдсонгүй.', 404);

  return hydrate(space, userId);
}

async function hydrate(space: CoupleSpaceRow, userId: string): Promise<CoupleSpace> {
  const supabase = await createClient();

  const [{ data: couple }, { data: members }] = await Promise.all([
    supabase.from('couples').select('person_a_id, person_b_id').eq('id', space.couple_id).maybeSingle(),
    supabase.from('couple_space_members').select('user_id, person_id').eq('space_id', space.id),
  ]);

  const partnerIds = [couple?.person_a_id, couple?.person_b_id]
    .filter((id): id is string => typeof id === 'string');

  const { data: people } = partnerIds.length
    ? await supabase.from('people').select('*').in('id', partnerIds)
    : { data: [] as PersonRow[] };

  // Keep the couple's own order: person_a first, as the tree records them.
  const byId = new Map((people ?? []).map((person) => [person.id, person]));
  const partners = partnerIds
    .map((id) => byId.get(id))
    .filter((person): person is PersonRow => Boolean(person));

  return {
    space,
    partners,
    partnerJoined: (members ?? []).length >= 2,
    meUserId: userId,
    myPersonId: (members ?? []).find((member) => member.user_id === userId)?.person_id ?? null,
  };
}

/**
 * The couples in this family the signed-in member could open a space for.
 *
 * Only relationships they are personally in: create_couple_space refuses the
 * rest at the database, and offering a choice the database will reject is a
 * worse experience than not offering it.
 */
export async function myCouples(familyId: string): Promise<Array<{
  id: string;
  partner: PersonRow | null;
  marriageDate: string | null;
  relationshipStart: string | null;
  hasSpace: boolean;
}>> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];

  const { data: membership } = await supabase
    .from('family_members')
    .select('person_id')
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .maybeSingle();

  const personId = membership?.person_id;
  // A member who is not linked to anyone in the tree cannot be in a couple:
  // ROOTS does not yet know which person they are.
  if (!personId) return [];

  const { data: couples } = await supabase
    .from('couples')
    .select('id, person_a_id, person_b_id, marriage_date, relationship_start')
    .or(`person_a_id.eq.${personId},person_b_id.eq.${personId}`)
    .is('deleted_at', null);

  if (!couples || couples.length === 0) return [];

  const partnerIds = couples
    .map((couple) => (couple.person_a_id === personId ? couple.person_b_id : couple.person_a_id))
    .filter((id): id is string => typeof id === 'string');

  const [{ data: people }, { data: existing }] = await Promise.all([
    partnerIds.length
      ? supabase.from('people').select('*').in('id', partnerIds)
      : Promise.resolve({ data: [] as PersonRow[] }),
    supabase.from('couple_spaces').select('couple_id').in('couple_id', couples.map((c) => c.id)),
  ]);

  const byId = new Map((people ?? []).map((person) => [person.id, person]));
  const spaced = new Set((existing ?? []).map((row) => row.couple_id));

  return couples.map((couple) => {
    const partnerId = couple.person_a_id === personId ? couple.person_b_id : couple.person_a_id;
    return {
      id: couple.id,
      partner: partnerId ? byId.get(partnerId) ?? null : null,
      marriageDate: couple.marriage_date,
      relationshipStart: couple.relationship_start,
      hasSpace: spaced.has(couple.id),
    };
  });
}
