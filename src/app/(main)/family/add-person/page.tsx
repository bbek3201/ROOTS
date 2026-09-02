import { requireActiveFamily } from '@/lib/family-context';
import { getFamilyGraph } from '@/lib/data/family';
import { can } from '@/lib/auth/session';
import { AppHeader } from '@/components/nav/AppHeader';
import { EmptyState } from '@/components/ui/States';
import { AddPersonFlow } from '@/components/family/AddPersonFlow';

export const dynamic = 'force-dynamic';

export default async function AddPersonPage() {
  const membership = await requireActiveFamily();

  if (!can(membership, 'edit')) {
    return (
      <>
        <AppHeader title="Хүн нэмэх" backHref="/family" />
        <main id="main" className="p-4">
          <EmptyState
            title="Эрх хүрэхгүй байна"
            description="Гэр бүлийн модонд хүн нэмэхийн тулд «Editor» болон түүнээс дээш эрх шаардлагатай. Архивын эзэнтэй холбогдоно уу."
          />
        </main>
      </>
    );
  }

  const graph = await getFamilyGraph(membership.family_id);

  return (
    <>
      <AppHeader title="Хүн нэмэх" subtitle={membership.family.name} backHref="/family" />
      <main id="main" className="px-4 pb-8 pt-5">
        <AddPersonFlow familyId={membership.family_id} graph={graph} />
      </main>
    </>
  );
}
