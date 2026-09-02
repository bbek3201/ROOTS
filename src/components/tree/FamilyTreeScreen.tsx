'use client';

import { useRouter } from 'next/navigation';
import { FamilyTree } from './FamilyTree';
import type { FamilyGraph } from '@/lib/relationships/types';

/**
 * Thin client wrapper that gives the tree a router.
 *
 * Keeping navigation out of FamilyTree keeps that component pure enough to be
 * rendered anywhere — including in a future print or export view that has no
 * router at all.
 */
export function FamilyTreeScreen({
  graph,
  focusPersonId,
  locale,
  visibleGenerations,
}: {
  graph: FamilyGraph;
  focusPersonId: string | null;
  locale: string;
  visibleGenerations: number;
}) {
  const router = useRouter();
  return (
    <FamilyTree
      graph={graph}
      focusPersonId={focusPersonId}
      locale={locale}
      visibleGenerations={visibleGenerations}
      onOpenPerson={(personId) => router.push(`/person/${personId}`)}
    />
  );
}
