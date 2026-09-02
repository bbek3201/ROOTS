import { requireUser } from '@/lib/auth/session';
import { requireActiveFamily } from '@/lib/family-context';
import { BottomNav } from '@/components/nav/BottomNav';

/**
 * The signed-in shell.
 *
 * Every page inside this group can assume a user AND a family, which is what
 * lets the pages themselves stay free of auth boilerplate. The bottom padding
 * clears the fixed navigation so nothing is ever hidden behind it.
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  await requireActiveFamily();

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto max-w-lg">{children}</div>
      <BottomNav />
    </div>
  );
}
