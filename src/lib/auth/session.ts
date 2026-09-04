import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { FamilyMemberRow, FamilyRole, FamilyRow, ProfileRow } from '@/types/database';

/**
 * Session and membership loading.
 *
 * Every function here is wrapped in React's `cache`, so a page that asks
 * "who is signed in?" in five different components pays for one query, not five.
 */

export interface Membership extends FamilyMemberRow {
  family: Pick<
    FamilyRow,
    | 'id'
    | 'name'
    | 'description'
    | 'default_locale'
    | 'visible_generations'
    | 'root_person_id'
    | 'root_couple_id'
    | 'cover_media_id'
  >;
}

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  // getUser() revalidates with the auth server; getSession() only reads the
  // cookie and can be spoofed, so it must not be used for authorisation.
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
});

export const getProfile = cache(async (): Promise<ProfileRow | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data ?? null;
});

/**
 * Columns of `families` the app reads alongside a membership.
 *
 * Split in two because these two lists can be out of step: a deploy carries new
 * code before someone runs the migration that adds the column it asks for. The
 * BASE list is everything that has existed since the first migration, and it is
 * the fallback below.
 */
const FAMILY_BASE_COLUMNS =
  'id, name, description, default_locale, visible_generations, root_person_id, root_couple_id';
const FAMILY_COLUMNS = `${FAMILY_BASE_COLUMNS}, cover_media_id`;

/**
 * Every family this user is an active member of, newest first.
 *
 * The fallback is not defensive programming for its own sake. Everything in
 * ROOTS hangs off this list: an empty result does not mean "query failed", it
 * means "this person has no family", and the app responds by sending them to
 * onboarding. So a database one migration behind — missing a single column this
 * build happens to ask for — would silently lock every existing member OUT of
 * their own archive, in a loop they cannot escape by creating a new one.
 *
 * Asking again for the columns that have always existed costs one round trip on
 * a database that is behind, and nothing at all on one that is current.
 */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();

  const load = (columns: string) =>
    supabase
      .from('family_members')
      .select(`*, family:families!inner(${columns})`)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('joined_at', { ascending: false });

  const { data, error } = await load(FAMILY_COLUMNS);
  if (!error && data) return data as unknown as Membership[];

  console.error(
    '[roots] membership query failed, retrying without newer columns:',
    error?.message ?? 'no data',
    '— apply the migrations in supabase/migrations to restore full functionality.',
  );

  const fallback = await load(FAMILY_BASE_COLUMNS);
  if (fallback.error || !fallback.data) {
    console.error('[roots] membership query failed:', fallback.error?.message ?? 'no data');
    return [];
  }

  // The archive works without the newer column; it simply has no cover yet.
  return fallback.data.map((row) => {
    const membership = row as unknown as Membership;
    return { ...membership, family: { ...membership.family, cover_media_id: null } };
  });
});

/**
 * The family the user is currently looking at.
 *
 * `familyId` comes from the URL, so it is untrusted input. Resolving it against
 * the user's OWN membership list is what makes changing the id in the address
 * bar useless — an id they are not a member of simply does not resolve.
 */
export const getActiveMembership = cache(async (familyId?: string): Promise<Membership | null> => {
  const memberships = await getMemberships();
  if (memberships.length === 0) return null;
  if (!familyId) return memberships[0] ?? null;
  return memberships.find((m) => m.family_id === familyId) ?? null;
});

const ROLE_RANK: Record<FamilyRole, number> = {
  owner: 5, admin: 4, editor: 3, contributor: 2, viewer: 1,
};

export function roleRank(role: FamilyRole): number {
  return ROLE_RANK[role] ?? 0;
}

export function hasRoleAtLeast(role: FamilyRole | undefined | null, minimum: FamilyRole): boolean {
  if (!role) return false;
  return roleRank(role) >= roleRank(minimum);
}

export const CAPABILITIES = {
  view: 'viewer',
  contribute: 'contributor',
  edit: 'editor',
  administer: 'admin',
  own: 'owner',
} as const satisfies Record<string, FamilyRole>;

export type Capability = keyof typeof CAPABILITIES;

export function can(membership: Membership | null, capability: Capability): boolean {
  return hasRoleAtLeast(membership?.role, CAPABILITIES[capability]);
}
