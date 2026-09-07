import { getProfile, requireUser } from '@/lib/auth/session';
import { requireActiveFamily } from '@/lib/family-context';
import { landingPhotographs } from '@/lib/landing-media';
import { AppShell } from '@/components/nav/AppShell';

/**
 * The signed-in shell.
 *
 * Every page inside this group can assume a user AND a family, which is what
 * lets the pages themselves stay free of auth boilerplate. The chrome around
 * them — sidebar, top bar, plate width — is decided by AppShell.
 *
 * The three things the chrome needs are loaded here, once, rather than by the
 * bars themselves: they are client components, and a client component cannot
 * ask the database who is signed in.
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const [membership, profile] = await Promise.all([requireActiveFamily(), getProfile()]);

  // The horizon at the foot of the sidebar. It comes from `public/landing/`
  // and never from the archive: those photographs are a family's own, served
  // through short-lived signed URLs, and the sidebar is rendered on every page
  // — including ones where a signed URL would have expired by the time it was
  // looked at. No folder, no photograph, and the wash stands in for it.
  const vista = landingPhotographs()[0] ?? null;

  return (
    <AppShell
      viewer={{
        name: profile?.display_name ?? 'Би',
        avatarUrl: profile?.avatar_url ?? null,
      }}
      family={membership.family.name}
      vista={vista}
    >
      {children}
    </AppShell>
  );
}
