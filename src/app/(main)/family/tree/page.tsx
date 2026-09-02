import { requireActiveFamily } from '@/lib/family-context';
import { getFamilyGraph } from '@/lib/data/family';
import { AppHeader } from '@/components/nav/AppHeader';
import { EmptyState } from '@/components/ui/States';
import { TreeIcon } from '@/components/icons';
import { FamilyTreeScreen } from '@/components/tree/FamilyTreeScreen';

export const dynamic = 'force-dynamic';

export default async function FamilyTreePage() {
  const membership = await requireActiveFamily();
  const graph = await getFamilyGraph(membership.family_id);

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader
        title="Гэр бүлийн мод"
        subtitle={`${graph.people.length} хүн · ${membership.family.visible_generations} үе`}
        backHref="/family"
      />
      <main id="main" className="min-h-0 flex-1">
        {graph.people.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<TreeIcon size={34} />}
              title="Мод хоосон байна"
              description="Эхний хүнээ нэмснээр мод ургаж эхэлнэ."
              action={{ label: 'Хүн нэмэх', href: '/family/add-person' }}
            />
          </div>
        ) : (
          <FamilyTreeScreen
            graph={graph}
            focusPersonId={membership.person_id}
            locale={membership.family.default_locale}
            visibleGenerations={membership.family.visible_generations}
          />
        )}
      </main>
    </div>
  );
}
