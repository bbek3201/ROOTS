import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentUser, getMemberships } from '@/lib/auth/session';

/**
 * The front door. Decides where a person actually belongs and sends them there,
 * so nobody ever lands on a page that cannot render for them.
 */
export default async function IndexPage() {
  if (!isSupabaseConfigured()) redirect('/setup');

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const memberships = await getMemberships();
  if (memberships.length === 0) redirect('/onboarding');

  redirect('/family');
}
