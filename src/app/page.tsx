import { isSupabaseConfigured } from '@/lib/env';
import { redirect } from 'next/navigation';
import { getCurrentUser, getMemberships } from '@/lib/auth/session';
import { landingPhotographs } from '@/lib/landing-media';
import { Landing } from '@/components/home/Landing';

export const dynamic = 'force-dynamic';

/**
 * The front door.
 *
 * It used to be a signpost that redirected everyone somewhere else, which meant
 * ROOTS had no home page at all: a visitor's first screen was a sign-in form,
 * and someone without a family yet was dropped straight into onboarding with no
 * way back to anything that explained the product.
 *
 * Now it is a page. The one exception is a person who already belongs to a
 * family — their home is their archive, and making them click past a landing
 * page every time they open the app would be a worse product for the only
 * people who use it daily.
 */
export default async function IndexPage() {
  if (!isSupabaseConfigured()) redirect('/setup');

  const user = await getCurrentUser();
  if (user) {
    const memberships = await getMemberships();
    if (memberships.length > 0) redirect('/family');
  }

  return <Landing signedIn={Boolean(user)} photographs={landingPhotographs()} />;
}
