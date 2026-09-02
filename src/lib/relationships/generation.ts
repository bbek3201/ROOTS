import type { FamilyIndex } from './graph';

/**
 * Generation calculation, mirroring roots.recompute_generations() in SQL.
 *
 * The database is the source of truth — people.generation is written there by
 * trigger. This implementation exists so the client can recompute instantly
 * after a local edit (no round trip while the user is dragging the tree), and
 * so the rule itself is unit-testable without a database. If the two ever
 * disagree, the database wins; the test suite exists to keep them in step.
 *
 * Rule: generation 1 is the oldest KNOWN ancestor. A child sits one below its
 * DEEPEST parent, so a person reached by both a short and a long lineage lands
 * on the row their deepest lineage puts them on and never floats above a parent.
 */
export function computeGenerations(index: FamilyIndex, maxIterations = 64): Map<string, number> {
  // Everyone starts at generation 1 and is pushed DOWN by two rules applied
  // until nothing moves:
  //
  //   1. a child sits at least one row below its deepest parent
  //   2. partners sit on the SAME row
  //
  // Rule 2 is why this is a relaxation rather than a single downward pass: a
  // partner who married in has no recorded parents of their own, so a naive
  // pass would seed them at generation 1 and leave them floating above their
  // own spouse. Values only ever increase and the parent graph is acyclic
  // (enforced by a database trigger), so this terminates.
  const generations = new Map<string, number>();
  for (const personId of index.people.keys()) generations.set(personId, 1);

  const limit = Math.min(maxIterations, index.people.size + 8);
  for (let iteration = 0; iteration < limit; iteration += 1) {
    let changed = false;

    for (const couple of index.couples.values()) {
      if (!couple.person_b_id) continue;
      const a = generations.get(couple.person_a_id);
      const b = generations.get(couple.person_b_id);
      if (a === undefined || b === undefined) continue;
      const deepest = Math.max(a, b);
      if (a !== deepest) { generations.set(couple.person_a_id, deepest); changed = true; }
      if (b !== deepest) { generations.set(couple.person_b_id, deepest); changed = true; }
    }

    for (const edges of index.childEdges.values()) {
      for (const edge of edges) {
        const parentGeneration = generations.get(edge.parent_id);
        const childGeneration = generations.get(edge.child_id);
        if (parentGeneration === undefined || childGeneration === undefined) continue;
        if (childGeneration < parentGeneration + 1) {
          generations.set(edge.child_id, parentGeneration + 1);
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  return generations;
}

export interface GenerationWindow {
  from: number;
  to: number;
  /** Generations older than `from` — kept in the archive, never deleted. */
  archivedAbove: number;
  /** Generations newer than `to`. */
  archivedBelow: number;
}

/**
 * Which slice of generations the main tree shows.
 *
 * ROOTS focuses on seven generations at a time because that is what a person
 * can actually hold in their head, and what fits on a phone. Everything outside
 * the window is still stored and still reachable through the archive — the
 * window is a lens, not a limit.
 */
export function generationWindow(
  focusGeneration: number,
  minGeneration: number,
  maxGeneration: number,
  size = 7,
): GenerationWindow {
  const span = Math.max(1, maxGeneration - minGeneration + 1);

  if (span <= size) {
    return { from: minGeneration, to: maxGeneration, archivedAbove: 0, archivedBelow: 0 };
  }

  // Lean upward: people open the tree to look at their ancestors far more often
  // than at their descendants, so the focus sits low in the window.
  const preferredFrom = focusGeneration - (size - 3);
  const from = Math.min(Math.max(preferredFrom, minGeneration), maxGeneration - size + 1);
  const to = from + size - 1;

  return {
    from,
    to,
    archivedAbove: Math.max(0, from - minGeneration),
    archivedBelow: Math.max(0, maxGeneration - to),
  };
}
