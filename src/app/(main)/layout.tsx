import { requireUser } from '@/lib/auth/session';
import { requireActiveFamily } from '@/lib/family-context';
import { AppShell } from '@/components/nav/AppShell';

/**
 * The signed-in shell.
 *
 * Every page inside this group can assume a user AND a family, which is what
 * lets the pages themselves stay free of auth boilerplate. The chrome around
 * them — column width, header, tab bar — is decided by AppShell.
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  await requireActiveFamily();

  return <AppShell>{children}</AppShell>;
}
