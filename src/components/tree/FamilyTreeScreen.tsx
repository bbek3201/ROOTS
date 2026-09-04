'use client';

import { useRouter } from 'next/navigation';
import { FamilyTree, type CoupleArchive } from './FamilyTree';
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
  photoUrls,
  coupleArchive,
  canEdit,
}: {
  graph: FamilyGraph;
  focusPersonId: string | null;
  locale: string;
  visibleGenerations: number;
  photoUrls?: Record<string, string>;
  coupleArchive?: Record<string, CoupleArchive>;
  canEdit?: boolean;
}) {
  const router = useRouter();
  return (
    <FamilyTree
      graph={graph}
      focusPersonId={focusPersonId}
      locale={locale}
      visibleGenerations={visibleGenerations}
      photoUrls={photoUrls}
      coupleArchive={coupleArchive}
      canEdit={canEdit}
      onOpenPerson={(personId) => router.push(`/person/${personId}`)}
      onOpenCouple={(coupleId) => router.push(`/couple/${coupleId}`)}
    />
  );
}
