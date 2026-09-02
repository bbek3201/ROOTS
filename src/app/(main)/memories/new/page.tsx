import { requireActiveFamily } from '@/lib/family-context';
import { getFamilyGraph } from '@/lib/data/family';
import { can } from '@/lib/auth/session';
import { AppHeader } from '@/components/nav/AppHeader';
import { EmptyState } from '@/components/ui/States';
import { NewMemoryForm } from '@/components/memories/NewMemoryForm';

export const dynamic = 'force-dynamic';

export default async function NewMemoryPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; couple?: string; type?: string }>;
}) {
  const membership = await requireActiveFamily();
  const { person, couple, type } = await searchParams;

  if (!can(membership, 'contribute')) {
    return (
      <>
        <AppHeader title="Дурсамж нэмэх" backHref="/memories" />
        <main id="main" className="p-4">
          <EmptyState
            title="Эрх хүрэхгүй байна"
            description="Дурсамж нэмэхийн тулд «Contributor» болон түүнээс дээш эрх хэрэгтэй."
          />
        </main>
      </>
    );
  }

  const graph = await getFamilyGraph(membership.family_id);

  return (
    <>
      <AppHeader title="Дурсамж нэмэх" subtitle={membership.family.name} backHref="/memories" />
      <main id="main" className="px-4 pb-8 pt-5">
        <NewMemoryForm
          familyId={membership.family_id}
          people={graph.people.map((p) => ({
            id: p.id,
            name: p.first_name,
            years: [p.birth_date?.slice(0, 4), p.death_date?.slice(0, 4)].filter(Boolean).join('–'),
          }))}
          presetPersonId={person ?? null}
          presetCoupleId={couple ?? null}
          presetType={type ?? null}
        />
      </main>
    </>
  );
}
