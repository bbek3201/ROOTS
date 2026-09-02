import type {
  CoupleNode,
  FamilyGraph,
  ParentChildEdge,
  PersonNode,
} from './types';

/**
 * An indexed, read-optimised view of a family graph.
 *
 * A whole family — even seven generations of it — is small enough to hold in
 * memory (hundreds to low thousands of nodes), so the tree, the relationship
 * calculator and the family assistant all work against one in-memory index
 * instead of issuing a query per hop.
 */
export interface FamilyIndex {
  familyId: string;
  people: Map<string, PersonNode>;
  couples: Map<string, CoupleNode>;
  /** childId → edges pointing at that child's parents. */
  parentEdges: Map<string, ParentChildEdge[]>;
  /** parentId → edges pointing at that parent's children. */
  childEdges: Map<string, ParentChildEdge[]>;
  /** personId → every couple they belong to, ordered oldest first. */
  couplesByPerson: Map<string, CoupleNode[]>;
  /** coupleId → children added through that couple. */
  childrenByCouple: Map<string, string[]>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

/** Ascending sort that always pushes unknown dates to the end. */
function byDate(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

export function buildFamilyIndex(graph: FamilyGraph): FamilyIndex {
  const people = new Map<string, PersonNode>();
  for (const person of graph.people) people.set(person.id, person);

  const couples = new Map<string, CoupleNode>();
  const couplesByPerson = new Map<string, CoupleNode[]>();
  for (const couple of graph.couples) {
    couples.set(couple.id, couple);
    push(couplesByPerson, couple.person_a_id, couple);
    if (couple.person_b_id) push(couplesByPerson, couple.person_b_id, couple);
  }
  for (const list of couplesByPerson.values()) {
    list.sort((x, y) => byDate(x.marriage_date ?? x.relationship_start, y.marriage_date ?? y.relationship_start));
  }

  const parentEdges = new Map<string, ParentChildEdge[]>();
  const childEdges = new Map<string, ParentChildEdge[]>();
  const childrenByCouple = new Map<string, string[]>();

  for (const edge of graph.parent_child) {
    // Ignore dangling edges rather than throwing: a partially loaded or
    // partially deleted graph should degrade, not crash the tree.
    if (!people.has(edge.parent_id) || !people.has(edge.child_id)) continue;
    push(parentEdges, edge.child_id, edge);
    push(childEdges, edge.parent_id, edge);
    if (edge.couple_id) {
      const existing = childrenByCouple.get(edge.couple_id);
      // Two edges (mother + father) exist per child, so de-duplicate.
      if (existing) {
        if (!existing.includes(edge.child_id)) existing.push(edge.child_id);
      } else {
        childrenByCouple.set(edge.couple_id, [edge.child_id]);
      }
    }
  }

  // Children of a couple are shown oldest-first, the way families list them.
  for (const [coupleId, childIds] of childrenByCouple) {
    childIds.sort((a, b) => byDate(people.get(a)?.birth_date ?? null, people.get(b)?.birth_date ?? null));
    childrenByCouple.set(coupleId, childIds);
  }

  return { familyId: graph.family_id, people, couples, parentEdges, childEdges, couplesByPerson, childrenByCouple };
}

// ---------------------------------------------------------------------------
// Direct relations
// ---------------------------------------------------------------------------

export function getPerson(index: FamilyIndex, id: string): PersonNode | undefined {
  return index.people.get(id);
}

export function getParentEdges(index: FamilyIndex, personId: string): ParentChildEdge[] {
  return index.parentEdges.get(personId) ?? [];
}

export function getParents(index: FamilyIndex, personId: string): PersonNode[] {
  return getParentEdges(index, personId)
    .map((edge) => index.people.get(edge.parent_id))
    .filter((p): p is PersonNode => p !== undefined);
}

export function getChildren(index: FamilyIndex, personId: string): PersonNode[] {
  const edges = index.childEdges.get(personId) ?? [];
  return edges
    .map((edge) => index.people.get(edge.child_id))
    .filter((p): p is PersonNode => p !== undefined)
    .sort((a, b) => byDate(a.birth_date, b.birth_date));
}

export function getCouples(index: FamilyIndex, personId: string): CoupleNode[] {
  return index.couplesByPerson.get(personId) ?? [];
}

export function getPartners(index: FamilyIndex, personId: string): PersonNode[] {
  const partners: PersonNode[] = [];
  for (const couple of getCouples(index, personId)) {
    const otherId = couple.person_a_id === personId ? couple.person_b_id : couple.person_a_id;
    if (!otherId) continue;
    const partner = index.people.get(otherId);
    if (partner) partners.push(partner);
  }
  return partners;
}

export function getCoupleChildren(index: FamilyIndex, coupleId: string): PersonNode[] {
  return (index.childrenByCouple.get(coupleId) ?? [])
    .map((id) => index.people.get(id))
    .filter((p): p is PersonNode => p !== undefined);
}

/**
 * Siblings, split by how much parentage they share.
 *
 * A "full" sibling shares every known parent; a "half" sibling shares at least
 * one but not all. Families care about this distinction and the database can
 * answer it exactly, so we never blur the two together.
 */
export function getSiblings(
  index: FamilyIndex,
  personId: string,
): { full: PersonNode[]; half: PersonNode[] } {
  const myParents = new Set(getParentEdges(index, personId).map((e) => e.parent_id));
  if (myParents.size === 0) return { full: [], half: [] };

  const shared = new Map<string, number>();
  for (const parentId of myParents) {
    for (const edge of index.childEdges.get(parentId) ?? []) {
      if (edge.child_id === personId) continue;
      shared.set(edge.child_id, (shared.get(edge.child_id) ?? 0) + 1);
    }
  }

  const full: PersonNode[] = [];
  const half: PersonNode[] = [];
  for (const [siblingId, sharedCount] of shared) {
    const sibling = index.people.get(siblingId);
    if (!sibling) continue;
    const theirParentCount = getParentEdges(index, siblingId).length;
    // Full only when neither side has a parent the other lacks.
    if (sharedCount === myParents.size && sharedCount === theirParentCount) full.push(sibling);
    else half.push(sibling);
  }

  const sortByBirth = (a: PersonNode, b: PersonNode) => byDate(a.birth_date, b.birth_date);
  return { full: full.sort(sortByBirth), half: half.sort(sortByBirth) };
}

export function getGrandparents(index: FamilyIndex, personId: string): PersonNode[] {
  const seen = new Set<string>();
  const out: PersonNode[] = [];
  for (const parent of getParents(index, personId)) {
    for (const grandparent of getParents(index, parent.id)) {
      if (seen.has(grandparent.id)) continue;
      seen.add(grandparent.id);
      out.push(grandparent);
    }
  }
  return out;
}

export function getGrandchildren(index: FamilyIndex, personId: string): PersonNode[] {
  const seen = new Set<string>();
  const out: PersonNode[] = [];
  for (const child of getChildren(index, personId)) {
    for (const grandchild of getChildren(index, child.id)) {
      if (seen.has(grandchild.id)) continue;
      seen.add(grandchild.id);
      out.push(grandchild);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Transitive traversal
// ---------------------------------------------------------------------------

export interface AncestorHit {
  /** Number of generations up from the starting person. */
  distance: number;
  /** Shortest chain from the start up to this ancestor, excluding the start. */
  via: string[];
  /** The first parent stepped through — tells us paternal vs maternal. */
  firstHopParentId: string;
}

/**
 * Every ancestor reachable from `personId`, with the shortest distance to each.
 * Breadth-first so the first time we see an ancestor we have the shortest path;
 * `maxDepth` bounds the walk even if bad data slipped past the cycle trigger.
 */
export function collectAncestors(
  index: FamilyIndex,
  personId: string,
  maxDepth = 12,
): Map<string, AncestorHit> {
  const found = new Map<string, AncestorHit>();
  let frontier: Array<{ id: string; via: string[]; firstHop: string | null }> = [
    { id: personId, via: [], firstHop: null },
  ];

  for (let distance = 1; distance <= maxDepth && frontier.length > 0; distance += 1) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const edge of getParentEdges(index, node.id)) {
        if (found.has(edge.parent_id) || edge.parent_id === personId) continue;
        const firstHop = node.firstHop ?? edge.parent_id;
        found.set(edge.parent_id, {
          distance,
          via: [...node.via, edge.parent_id],
          firstHopParentId: firstHop,
        });
        next.push({ id: edge.parent_id, via: [...node.via, edge.parent_id], firstHop });
      }
    }
    frontier = next;
  }

  return found;
}

export function collectDescendants(
  index: FamilyIndex,
  personId: string,
  maxDepth = 12,
): Map<string, { distance: number; via: string[] }> {
  const found = new Map<string, { distance: number; via: string[] }>();
  let frontier: Array<{ id: string; via: string[] }> = [{ id: personId, via: [] }];

  for (let distance = 1; distance <= maxDepth && frontier.length > 0; distance += 1) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const edge of index.childEdges.get(node.id) ?? []) {
        if (found.has(edge.child_id) || edge.child_id === personId) continue;
        const via = [...node.via, edge.child_id];
        found.set(edge.child_id, { distance, via });
        next.push({ id: edge.child_id, via });
      }
    }
    frontier = next;
  }

  return found;
}

/** People with no recorded parents — where the family's known history begins. */
export function getRootPeople(index: FamilyIndex): PersonNode[] {
  const roots: PersonNode[] = [];
  for (const person of index.people.values()) {
    if (getParentEdges(index, person.id).length === 0) roots.push(person);
  }
  return roots.sort((a, b) => byDate(a.birth_date, b.birth_date));
}
