import { getParentEdges, type FamilyIndex } from '@/lib/relationships/graph';
import type { CoupleNode, PersonNode } from '@/lib/relationships/types';

/**
 * Family tree layout.
 *
 * A genealogy tree is not a plain tree: couples are joint nodes, a person can
 * belong to several couples over a lifetime, and two people who marry may each
 * descend from a branch already in the tree. Laying it out as if it were a
 * simple parent→children tree produces either duplicated people or crossed
 * lines, so the unit below is the real primitive.
 *
 * A UNIT is one anchor person plus the partners who married in to them.
 *   · The anchor is the person with recorded parents — they are the one who
 *     "hangs" from the generation above.
 *   · A partner with no parents in this family is drawn inside the unit.
 *   · When BOTH partners descend from branches already in the tree, each keeps
 *     their own unit and the marriage is drawn as a connector between them,
 *     rather than duplicating one of them.
 *
 * Everything here is pure: given the same graph it produces the same
 * coordinates, which makes the layout unit-testable and the rendering dumb.
 */

export const NODE_WIDTH = 88;
export const NODE_HEIGHT = 104;
export const PARTNER_GAP = 14;
export const UNIT_GAP = 26;
export const ROW_HEIGHT = 208;

export interface TreeUnit {
  id: string;
  anchorId: string;
  /** Partners drawn inside this unit, in marriage order. */
  partners: Array<{ coupleId: string; personId: string }>;
  generation: number;
  /** Units for the children of this unit's couples. */
  childUnitIds: string[];
  parentUnitId: string | null;
  x: number;
  y: number;
  width: number;
}

export interface TreeLayout {
  units: TreeUnit[];
  unitByPerson: Map<string, string>;
  unitsById: Map<string, TreeUnit>;
  /** Marriages between two people who each anchor their own unit. */
  crossLinks: Array<{ coupleId: string; fromUnitId: string; toUnitId: string }>;
  bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
  generations: number[];
  personPositions: Map<string, { x: number; y: number; unitId: string }>;
}

interface Options {
  /** Only lay out these generations; the rest stay in the archive. */
  fromGeneration?: number;
  toGeneration?: number;
}

export function layoutFamilyTree(index: FamilyIndex, options: Options = {}): TreeLayout {
  const inWindow = (person: PersonNode): boolean => {
    const generation = person.generation ?? 1;
    if (options.fromGeneration !== undefined && generation < options.fromGeneration) return false;
    if (options.toGeneration !== undefined && generation > options.toGeneration) return false;
    return true;
  };

  const visible = [...index.people.values()].filter(inWindow);
  const visibleIds = new Set(visible.map((person) => person.id));

  // --- decide who anchors, and where each couple is drawn -------------------
  const hasParents = (personId: string) =>
    getParentEdges(index, personId).some((edge) => visibleIds.has(edge.parent_id));

  const coupleHost = new Map<string, { hostId: string; guestId: string | null }>();
  for (const couple of index.couples.values()) {
    const a = visibleIds.has(couple.person_a_id) ? couple.person_a_id : null;
    const b = couple.person_b_id && visibleIds.has(couple.person_b_id) ? couple.person_b_id : null;
    if (!a && !b) continue;

    if (a && b) {
      const aRooted = hasParents(a);
      const bRooted = hasParents(b);
      // The partner who descends from this family anchors; if both do, or
      // neither does, fall back to canonical order so layout is deterministic.
      const hostId = aRooted && !bRooted ? a : bRooted && !aRooted ? b : a;
      coupleHost.set(couple.id, { hostId, guestId: hostId === a ? b : a });
    } else {
      coupleHost.set(couple.id, { hostId: (a ?? b) as string, guestId: null });
    }
  }

  // A person is a "guest" when they are drawn inside someone else's unit.
  const guestOf = new Map<string, string>();
  for (const [coupleId, { hostId, guestId }] of coupleHost) {
    if (!guestId) continue;
    if (hasParents(guestId)) continue; // they anchor their own unit instead
    if (guestOf.has(guestId)) continue; // already placed with an earlier partner
    guestOf.set(guestId, coupleId);
    void hostId;
  }

  // --- build units ---------------------------------------------------------
  const unitsById = new Map<string, TreeUnit>();
  const unitByPerson = new Map<string, string>();

  for (const person of visible) {
    if (guestOf.has(person.id)) continue;
    const unitId = `unit:${person.id}`;
    unitsById.set(unitId, {
      id: unitId,
      anchorId: person.id,
      partners: [],
      generation: person.generation ?? 1,
      childUnitIds: [],
      parentUnitId: null,
      x: 0,
      y: 0,
      width: NODE_WIDTH,
    });
    unitByPerson.set(person.id, unitId);
  }

  // Attach guests to their host's unit.
  const sortedCouples = [...index.couples.values()].sort(byMarriageDate);
  for (const couple of sortedCouples) {
    const host = coupleHost.get(couple.id);
    if (!host) continue;
    const guestId = host.guestId;
    if (!guestId || guestOf.get(guestId) !== couple.id) continue;

    const unitId = unitByPerson.get(host.hostId);
    const unit = unitId ? unitsById.get(unitId) : undefined;
    if (!unit) continue;

    unit.partners.push({ coupleId: couple.id, personId: guestId });
    unitByPerson.set(guestId, unit.id);
  }

  for (const unit of unitsById.values()) {
    unit.width = NODE_WIDTH + unit.partners.length * (NODE_WIDTH + PARTNER_GAP);
  }

  // --- link children to their parents' units -------------------------------
  for (const unit of unitsById.values()) {
    const memberIds = [unit.anchorId, ...unit.partners.map((partner) => partner.personId)];
    const childUnitIds = new Set<string>();

    for (const memberId of memberIds) {
      for (const edge of index.childEdges.get(memberId) ?? []) {
        if (!visibleIds.has(edge.child_id)) continue;
        const childUnitId = unitByPerson.get(edge.child_id);
        // A child rendered as someone's guest partner is drawn there, not here.
        if (!childUnitId || unitsById.get(childUnitId)?.anchorId !== edge.child_id) continue;
        childUnitIds.add(childUnitId);
      }
    }

    unit.childUnitIds = [...childUnitIds].sort((a, b) => {
      const personA = index.people.get(unitsById.get(a)?.anchorId ?? '');
      const personB = index.people.get(unitsById.get(b)?.anchorId ?? '');
      return compareDates(personA?.birth_date ?? null, personB?.birth_date ?? null);
    });

    for (const childUnitId of unit.childUnitIds) {
      const child = unitsById.get(childUnitId);
      // First parent wins; a child of two anchored units still hangs from one
      // place, and the other link is drawn as a secondary connector.
      if (child && child.parentUnitId === null) child.parentUnitId = unit.id;
    }
  }

  // --- position ------------------------------------------------------------
  const roots = [...unitsById.values()]
    .filter((unit) => unit.parentUnitId === null)
    .sort((a, b) => {
      if (a.generation !== b.generation) return a.generation - b.generation;
      const personA = index.people.get(a.anchorId);
      const personB = index.people.get(b.anchorId);
      return compareDates(personA?.birth_date ?? null, personB?.birth_date ?? null);
    });

  const minGeneration = Math.min(...[...unitsById.values()].map((unit) => unit.generation), 1);
  let cursor = 0;
  const placed = new Set<string>();

  const place = (unitId: string): void => {
    const unit = unitsById.get(unitId);
    if (!unit || placed.has(unitId)) return;
    placed.add(unitId);

    unit.y = (unit.generation - minGeneration) * ROW_HEIGHT;

    const children = unit.childUnitIds.filter((id) => !placed.has(id));
    if (children.length === 0) {
      unit.x = cursor;
      cursor += unit.width + UNIT_GAP;
      return;
    }

    for (const childId of children) place(childId);

    const positioned = children
      .map((id) => unitsById.get(id))
      .filter((child): child is TreeUnit => child !== undefined);

    const first = positioned[0];
    const last = positioned[positioned.length - 1];
    if (!first || !last) {
      unit.x = cursor;
      cursor += unit.width + UNIT_GAP;
      return;
    }

    // Centre the parents over the span of their children. This can push the
    // unit left of where the cursor already reached, which is what the
    // separation pass below exists to repair.
    const centre = (first.x + last.x + last.width) / 2;
    unit.x = centre - unit.width / 2;

    if (unit.x + unit.width + UNIT_GAP > cursor) {
      cursor = unit.x + unit.width + UNIT_GAP;
    }
  };

  for (const root of roots) place(root.id);
  // Anything unreachable (a cycle guard, or a child of two anchored units).
  for (const unit of unitsById.values()) place(unit.id);

  relaxPositions(unitsById);

  // --- cross links: marriages between two anchored units -------------------
  const crossLinks: TreeLayout['crossLinks'] = [];
  for (const couple of index.couples.values()) {
    const host = coupleHost.get(couple.id);
    if (!host?.guestId) continue;
    if (guestOf.get(host.guestId) === couple.id) continue; // drawn inside a unit
    const fromUnitId = unitByPerson.get(host.hostId);
    const toUnitId = unitByPerson.get(host.guestId);
    if (fromUnitId && toUnitId && fromUnitId !== toUnitId) {
      crossLinks.push({ coupleId: couple.id, fromUnitId, toUnitId });
    }
  }

  // --- per-person coordinates, for selection and highlighting ---------------
  const personPositions = new Map<string, { x: number; y: number; unitId: string }>();
  for (const unit of unitsById.values()) {
    personPositions.set(unit.anchorId, { x: unit.x, y: unit.y, unitId: unit.id });
    unit.partners.forEach((partner, position) => {
      personPositions.set(partner.personId, {
        x: unit.x + (position + 1) * (NODE_WIDTH + PARTNER_GAP),
        y: unit.y,
        unitId: unit.id,
      });
    });
  }

  const units = [...unitsById.values()];
  const xs = units.map((unit) => unit.x);
  const rights = units.map((unit) => unit.x + unit.width);
  const ys = units.map((unit) => unit.y);

  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = rights.length ? Math.max(...rights) : NODE_WIDTH;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) + NODE_HEIGHT : NODE_HEIGHT;

  return {
    units,
    unitsById,
    unitByPerson,
    crossLinks,
    personPositions,
    generations: [...new Set(units.map((unit) => unit.generation))].sort((a, b) => a - b),
    bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
  };
}

/**
 * Repair pass.
 *
 * The recursive placement centres each parent over its children, which is what
 * makes a family tree readable — but centring can push a unit left, into a
 * sibling subtree that was already placed. This alternates two corrections
 * until they stop fighting:
 *
 *   separate — walk each row left to right and push overlapping units right,
 *              carrying their whole subtree so children stay under parents
 *   recentre — bottom-up, re-centre each parent over its (now moved) children
 *
 * It always ends with a separation pass, so the returned layout is guaranteed
 * overlap-free even if the two corrections had not fully converged.
 */
function relaxPositions(unitsById: Map<string, TreeUnit>): void {
  const rows = new Map<number, TreeUnit[]>();
  for (const unit of unitsById.values()) {
    const row = rows.get(unit.y);
    if (row) row.push(unit);
    else rows.set(unit.y, [unit]);
  }
  const orderedRows = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, units]) => units);

  const shiftSubtree = (unit: TreeUnit, dx: number, seen = new Set<string>()): void => {
    if (seen.has(unit.id)) return;
    seen.add(unit.id);
    unit.x += dx;
    for (const childId of unit.childUnitIds) {
      const child = unitsById.get(childId);
      if (child) shiftSubtree(child, dx, seen);
    }
  };

  const separate = (): boolean => {
    let moved = false;
    for (const row of orderedRows) {
      row.sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i += 1) {
        const previous = row[i - 1];
        const current = row[i];
        if (!previous || !current) continue;
        const overlap = previous.x + previous.width + UNIT_GAP - current.x;
        if (overlap > 0.5) {
          shiftSubtree(current, overlap);
          moved = true;
        }
      }
    }
    return moved;
  };

  const recentre = (): boolean => {
    let moved = false;
    for (let i = orderedRows.length - 1; i >= 0; i -= 1) {
      const row = orderedRows[i];
      if (!row) continue;
      for (const unit of row) {
        const children = unit.childUnitIds
          .map((id) => unitsById.get(id))
          .filter((child): child is TreeUnit => child !== undefined);
        if (children.length === 0) continue;

        const left = Math.min(...children.map((child) => child.x));
        const right = Math.max(...children.map((child) => child.x + child.width));
        const target = (left + right) / 2 - unit.width / 2;
        if (Math.abs(target - unit.x) > 0.5) {
          unit.x = target;
          moved = true;
        }
      }
    }
    return moved;
  };

  for (let pass = 0; pass < 12; pass += 1) {
    const separated = separate();
    const recentred = recentre();
    if (!separated && !recentred) break;
  }

  // The last word belongs to separation: overlap-free is non-negotiable,
  // perfect centring is not.
  separate();
}

function byMarriageDate(a: CoupleNode, b: CoupleNode): number {
  return compareDates(a.marriage_date ?? a.relationship_start, b.marriage_date ?? b.relationship_start);
}

function compareDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}
