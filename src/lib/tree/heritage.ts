import { getCouples, getParents, type FamilyIndex } from '@/lib/relationships/graph';
import type { CoupleNode, PersonNode } from '@/lib/relationships/types';

/**
 * The family arranged as it is actually experienced: outward from you.
 *
 * The `generation` column counts DOWN from the oldest known ancestor, because
 * that is the only stable numbering when a tree is edited from both ends — add
 * a great-grandmother and every "generation 1" would otherwise have to be
 * renumbered. It is the right thing to store and the wrong thing to show. A
 * person opening the tree is not looking for generation 4; they are looking for
 * their grandmother, and she is two steps up from them.
 *
 * So this walks up from the viewer: band 0 is them and their partner, band 1 is
 * their parents, band 2 their grandparents, and so on. The database numbering is
 * never shown.
 */

export interface HeritageUnit {
  /** The couple's id where there is one, otherwise the lone person's. */
  id: string;
  href: string;
  people: PersonNode[];
  /** True when the two are a recorded couple rather than a single parent. */
  paired: boolean;
}

export interface HeritageBand {
  /** 0 = the viewer, 1 = their parents, 2 = grandparents … */
  depth: number;
  units: HeritageUnit[];
}

/** How many ancestral steps the banded view shows before it collapses. */
export const HERITAGE_BANDS = 3;

function unitFor(index: FamilyIndex, person: PersonNode, used: Set<string>): HeritageUnit | null {
  if (used.has(person.id)) return null;

  // A person can be in more than one couple over a life. The FIRST is the one
  // the graph orders oldest-first, which for an ancestor is the union the rest
  // of this band descends from — the one worth drawing here.
  const couple: CoupleNode | undefined = getCouples(index, person.id)[0];
  const partnerId = couple
    ? couple.person_a_id === person.id
      ? couple.person_b_id
      : couple.person_a_id
    : null;
  // A partner already standing in an earlier band is not drawn a second time.
  // Without this a family where two siblings married two siblings — or simply
  // one where a parent appears in the band above — shows the same face twice.
  const candidate = partnerId ? index.people.get(partnerId) : undefined;
  const partner = candidate && !used.has(candidate.id) ? candidate : undefined;

  used.add(person.id);
  if (partner) used.add(partner.id);

  // Keep the couple's own recorded order, so the same pair is never drawn
  // mirrored on two different screens.
  const people = partner
    ? couple && couple.person_a_id === person.id
      ? [person, partner]
      : [partner, person]
    : [person];

  return {
    id: couple?.id ?? person.id,
    href: couple ? `/couple/${couple.id}` : `/person/${person.id}`,
    people,
    paired: Boolean(partner),
  };
}

/**
 * Bands of ancestors, starting from one person.
 *
 * Returns at most `maxBands` bands and stops early when a line runs out — a
 * family that has only recorded two generations gets two bands, not four empty
 * ones. Everyone is placed exactly once, so a cousin marriage does not draw the
 * same couple twice in one band.
 */
export function buildAncestry(
  index: FamilyIndex,
  focusPersonId: string | null,
  maxBands = HERITAGE_BANDS,
): HeritageBand[] {
  if (!focusPersonId) return [];
  const focus = index.people.get(focusPersonId);
  if (!focus) return [];

  const bands: HeritageBand[] = [];
  const used = new Set<string>();
  let frontier: PersonNode[] = [focus];

  for (let depth = 0; depth < maxBands && frontier.length > 0; depth += 1) {
    const units: HeritageUnit[] = [];
    for (const person of frontier) {
      const unit = unitFor(index, person, used);
      if (unit) units.push(unit);
    }

    if (units.length === 0) break;
    bands.push({ depth, units });

    // The next band is the parents of everyone standing in this one — both
    // halves of each couple, so a family reached through marriage is not lost.
    const next: PersonNode[] = [];
    const seen = new Set<string>();
    for (const unit of units) {
      for (const person of unit.people) {
        for (const parent of getParents(index, person.id)) {
          if (seen.has(parent.id) || used.has(parent.id)) continue;
          seen.add(parent.id);
          next.push(parent);
        }
      }
    }
    frontier = next;
  }

  return bands;
}

/**
 * How many people are further up the tree than the bands show.
 *
 * Drives the "expand deep ancestry" line: a number nobody can see yet is a
 * reason to tap, and "0 more" would be a door onto an empty room.
 */
export function deeperCount(index: FamilyIndex, bands: HeritageBand[]): number {
  const shown = new Set(bands.flatMap((band) => band.units.flatMap((unit) => unit.people.map((p) => p.id))));
  if (shown.size === 0) return 0;

  // Everyone reachable upwards from the last band, however far up it goes.
  const queue = bands[bands.length - 1]?.units.flatMap((unit) => unit.people) ?? [];
  const deeper = new Set<string>();
  const stack = [...queue];

  while (stack.length > 0) {
    const person = stack.pop() as PersonNode;
    for (const parent of getParents(index, person.id)) {
      if (shown.has(parent.id) || deeper.has(parent.id)) continue;
      deeper.add(parent.id);
      stack.push(parent);
    }
  }

  return deeper.size;
}

/**
 * The fallback when ROOTS does not know which person the viewer is.
 *
 * A member who has not been linked to anyone in the tree still deserves to see
 * it, so the bands run oldest-first from the roots instead of outward from a
 * person who does not exist.
 */
export function buildFromRoots(index: FamilyIndex, maxBands = HERITAGE_BANDS): HeritageBand[] {
  const byGeneration = new Map<number, PersonNode[]>();
  for (const person of index.people.values()) {
    if (person.is_archived) continue;
    const generation = person.generation ?? 1;
    const bucket = byGeneration.get(generation) ?? [];
    bucket.push(person);
    byGeneration.set(generation, bucket);
  }

  const used = new Set<string>();
  return [...byGeneration.keys()]
    .sort((a, b) => a - b)
    .slice(0, maxBands)
    .map((generation, depth) => ({
      depth,
      units: (byGeneration.get(generation) ?? [])
        .map((person) => unitFor(index, person, used))
        .filter((unit): unit is HeritageUnit => unit !== null),
    }))
    .filter((band) => band.units.length > 0);
}
