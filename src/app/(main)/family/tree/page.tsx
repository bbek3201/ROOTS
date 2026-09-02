import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { getFamilyGraph, getMediaPaths } from '@/lib/data/family';
import { getSignedUrls } from '@/lib/media/storage';
import { EmptyState } from '@/components/ui/States';
import { Display, Eyebrow } from '@/components/ui/Editorial';
import { ChevronLeftIcon, TreeIcon } from '@/components/icons';
import { FamilyTreeScreen } from '@/components/tree/FamilyTreeScreen';

export const dynamic = 'force-dynamic';

export default async function FamilyTreePage() {
  const membership = await requireActiveFamily();
  const graph = await getFamilyGraph(membership.family_id);

  // Portraits, resolved once for the whole canvas: the tree draws faces, and
  // signing them one node at a time while panning would be unusable.
  const paths = await getMediaPaths(graph.people.map((person) => person.profile_photo_media_id));
  const signed = await getSignedUrls([...paths.values()]);
  const photoUrls: Record<string, string> = {};
  for (const person of graph.people) {
    const path = person.profile_photo_media_id ? paths.get(person.profile_photo_media_id) : null;
    const url = path ? signed.get(path) : null;
    if (url) photoUrls[person.id] = url;
  }

  const generations = new Set(graph.people.map((person) => person.generation ?? 0)).size;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 px-5 pb-3 pt-6">
        <Link
          href="/family"
          aria-label="Буцах"
          className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-parchment-deep"
        >
          <ChevronLeftIcon size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <Eyebrow>
            {graph.people.length} хүн · {generations || membership.family.visible_generations} үе
          </Eyebrow>
          <Display as="h1" size="sm" className="mt-1">
            Гэр бүлийн мод
          </Display>
        </div>
      </header>

      <main id="main" className="min-h-0 flex-1">
        {graph.people.length === 0 ? (
          <div className="px-5 pt-4">
            <EmptyState
              icon={<TreeIcon size={30} />}
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
            photoUrls={photoUrls}
          />
        )}
      </main>
    </div>
  );
}
