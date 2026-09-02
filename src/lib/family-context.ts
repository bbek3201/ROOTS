import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getMemberships, type Membership } from '@/lib/auth/session';

export const ACTIVE_FAMILY_COOKIE = 'roots.family';

/**
 * Which family the user is currently viewing.
 *
 * The cookie is a CONVENIENCE, not a credential: it is always resolved against
 * the user's own membership list, so setting it by hand to another family's id
 * simply falls back to their first real family. There is no code path where a
 * cookie value reaches a query unchecked.
 */
export const getActiveFamily = cache(async (): Promise<Membership | null> => {
  const memberships = await getMemberships();
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_FAMILY_COOKIE)?.value;

  const match = preferred ? memberships.find((m) => m.family_id === preferred) : undefined;
  return match ?? memberships[0] ?? null;
});

/** Throws through to a redirect when there is no family yet. */
export async function requireActiveFamily(): Promise<Membership> {
  const membership = await getActiveFamily();
  // redirect() throws, so control never reaches the return with a null value.
  if (!membership) redirect('/onboarding');
  return membership;
}
