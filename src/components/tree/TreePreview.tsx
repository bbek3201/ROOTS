'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { buildFamilyIndex, getParents, getPartners, getChildren } from '@/lib/relationships/graph';
import { displayName, lifespan } from '@/lib/format';
import type { FamilyGraph, PersonNode } from '@/lib/relationships/types';
import { Avatar } from '@/components/ui/Avatar';

/**
 * A compact three-generation glance at the tree for the home screen.
 *
 * Not a shrunken version of the full canvas: a pannable graph inside a
 * scrolling page fights the page for every gesture. This shows the viewer's own
 * immediate line — parents, partners, children — as tappable rows, and hands off
 * to the real tree for anything more.
 */
export function TreePreview({
  graph,
  focusPersonId,
}: {
  graph: FamilyGraph;
  focusPersonId: string | null;
}) {
  const index = useMemo(() => buildFamilyIndex(graph), [graph]);

  const focus = focusPersonId ? index.people.get(focusPersonId) : undefined;

  // With no "this is me" link yet, show the oldest generation — the part of the
  // tree a family is usually most anxious not to lose.
  const anchor = focus ?? oldestPerson(index.people.values());
  if (!anchor) return null;

  const rows: Array<{ label: string; people: PersonNode[] }> = [
    { label: 'Эцэг эх', people: getParents(index, anchor.id) },
    { label: focus ? 'Та' : 'Хамгийн ахмад үе', people: [anchor] },
    { label: 'Хань', people: getPartners(index, anchor.id) },
    { label: 'Хүүхдүүд', people: getChildren(index, anchor.id) },
  ].filter((row) => row.people.length > 0);

  return (
    <div className="card overflow-hidden p-0">
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.label} className="px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{row.label}</p>
            <ul className="flex gap-2 overflow-x-auto no-scrollbar">
              {row.people.map((person) => (
                <li key={person.id}>
                  <Link
                    href={`/person/${person.id}`}
                    className="flex w-20 flex-col items-center gap-1.5 rounded-xl px-1 py-1.5 text-center"
                  >
                    <Avatar person={person} size="sm" />
                    <span className="w-full truncate text-xs font-medium text-ink">
                      {displayName(person)}
                    </span>
                    <span className="text-[0.65rem] text-muted">{lifespan(person)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <Link
        href="/family/tree"
        className="block border-t border-line bg-parchment-deep/60 px-4 py-3 text-center text-sm font-medium text-forest"
      >
        Бүтэн модыг үзэх
      </Link>
    </div>
  );
}

function oldestPerson(people: Iterable<PersonNode>): PersonNode | undefined {
  let best: PersonNode | undefined;
  for (const person of people) {
    if (!best) { best = person; continue; }
    const bestGeneration = best.generation ?? 99;
    const generation = person.generation ?? 99;
    if (generation < bestGeneration) best = person;
  }
  return best;
}
