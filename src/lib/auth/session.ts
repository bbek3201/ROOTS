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
  family: Pick<FamilyRow, 'id' | 'name' | 'default_locale' | 'visible_generations' | 'root_person_id' | 'root_couple_id'>;
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

/** Every family this user is an active member of, newest first. */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('family_members')
    .select('*, family:families!inner(id, name, default_locale, visible_generations, root_person_id, root_couple_id)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: false });

  if (error || !data) return [];
  return data as unknown as Membership[];
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
