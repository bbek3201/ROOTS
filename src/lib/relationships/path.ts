import {
  collectAncestors,
  collectDescendants,
  getCouples,
  getParentEdges,
  type FamilyIndex,
} from './graph';
import type {
  GenderBucket,
  LineageSide,
  RelationshipDescriptor,
  RelationshipResult,
  RelationshipStep,
} from './types';

/**
 * Relationship calculation.
 *
 * Everything here is structural and language-free. The answer to "how am I
 * related to Dorj?" is computed from the graph — never stored, never guessed —
 * and only afterwards handed to a kinship locale to be named.
 */

interface Options {
  /** Depth cap for the ancestor/descendant walks. */
  maxDepth?: number;
  /** Internal: suppress path building and in-law search during recursion. */
  shallow?: boolean;
}

function genderOf(index: FamilyIndex, id: string | undefined): GenderBucket {
  if (!id) return 'unknown';
  return index.people.get(id)?.gender ?? 'unknown';
}

function sideFromParent(index: FamilyIndex, parentId: string | undefined): LineageSide {
  const gender = genderOf(index, parentId);
  if (gender === 'male') return 'paternal';
  if (gender === 'female') return 'maternal';
  return 'unknown';
}

function compareAges(index: FamilyIndex, a: string, b: string): 'older' | 'younger' | 'unknown' {
  const birthA = index.people.get(a)?.birth_date ?? null;
  const birthB = index.people.get(b)?.birth_date ?? null;
  if (!birthA || !birthB || birthA === birthB) return 'unknown';
  // "older" describes the TARGET relative to the subject.
  return birthB < birthA ? 'older' : 'younger';
}

const UNRELATED: RelationshipDescriptor = {
  kind: 'unrelated',
  up: 0,
  down: 0,
  side: 'unknown',
  targetGender: 'unknown',
};

/**
 * How is `toId` related to `fromId`?
 *
 * Returns null-free results: an unknown or absent link is reported as
 * kind 'unrelated' rather than as a guess. The family assistant depends on this
 * — "unknown" must be a real answer, never an invented one.
 */
export function computeRelationship(
  index: FamilyIndex,
  fromId: string,
  toId: string,
  options: Options = {},
): RelationshipResult {
  const maxDepth = options.maxDepth ?? 12;
  const empty = (descriptor: RelationshipDescriptor): RelationshipResult => ({
    from: fromId,
    to: toId,
    descriptor,
    path: [],
    commonAncestorIds: [],
  });

  if (!index.people.has(fromId) || !index.people.has(toId)) return empty(UNRELATED);

  const targetGender = genderOf(index, toId);

  if (fromId === toId) {
    return {
      from: fromId,
      to: toId,
      descriptor: { kind: 'self', up: 0, down: 0, side: 'unknown', targetGender },
      path: [{ personId: fromId, direction: 'self', descriptor: { kind: 'self', up: 0, down: 0, side: 'unknown', targetGender } }],
      commonAncestorIds: [],
    };
  }

  // --- partners ------------------------------------------------------------
  for (const couple of getCouples(index, fromId)) {
    const otherId = couple.person_a_id === fromId ? couple.person_b_id : couple.person_a_id;
    if (otherId === toId) {
      const descriptor: RelationshipDescriptor = {
        kind: 'partner', up: 0, down: 0, side: 'unknown', targetGender,
      };
      return {
        from: fromId,
        to: toId,
        descriptor,
        path: buildPath(index, [fromId, toId], ['self', 'partner'], options),
        commonAncestorIds: [],
      };
    }
  }

  const ancestorsOfFrom = collectAncestors(index, fromId, maxDepth);
  const ancestorsOfTo = collectAncestors(index, toId, maxDepth);

  // --- direct ancestor: my parent, grandparent, great-grandparent ... -------
  const asAncestor = ancestorsOfFrom.get(toId);
  if (asAncestor) {
    const edge = asAncestor.distance === 1
      ? getParentEdges(index, fromId).find((e) => e.parent_id === toId)
      : undefined;
    const descriptor: RelationshipDescriptor = {
      kind: 'ancestor',
      up: asAncestor.distance,
      down: 0,
      side: sideFromParent(index, asAncestor.firstHopParentId),
      targetGender,
      ...(edge ? { edgeType: edge.relationship_type } : {}),
    };
    return {
      from: fromId,
      to: toId,
      descriptor,
      path: buildPath(index, [fromId, ...asAncestor.via], ['self', ...asAncestor.via.map(() => 'up' as const)], options),
      commonAncestorIds: [toId],
    };
  }

  // --- direct descendant: my child, grandchild ... --------------------------
  const descendants = collectDescendants(index, fromId, maxDepth);
  const asDescendant = descendants.get(toId);
  if (asDescendant) {
    const descriptor: RelationshipDescriptor = {
      kind: 'descendant',
      up: 0,
      down: asDescendant.distance,
      side: 'unknown',
      targetGender,
      // The first hop down decides ач (through a son) vs зээ (through a daughter).
      viaGender: genderOf(index, asDescendant.via[0]),
    };
    return {
      from: fromId,
      to: toId,
      descriptor,
      path: buildPath(index, [fromId, ...asDescendant.via], ['self', ...asDescendant.via.map(() => 'down' as const)], options),
      commonAncestorIds: [fromId],
    };
  }

  // --- collateral: find the nearest common ancestor -------------------------
  let best: { ancestorId: string; up: number; down: number } | null = null;
  const tiedAncestors: string[] = [];

  for (const [ancestorId, hitFrom] of ancestorsOfFrom) {
    const hitTo = ancestorsOfTo.get(ancestorId);
    if (!hitTo) continue;
    const total = hitFrom.distance + hitTo.distance;
    if (!best) {
      best = { ancestorId, up: hitFrom.distance, down: hitTo.distance };
      tiedAncestors.push(ancestorId);
      continue;
    }
    const bestTotal = best.up + best.down;
    if (total < bestTotal) {
      best = { ancestorId, up: hitFrom.distance, down: hitTo.distance };
      tiedAncestors.length = 0;
      tiedAncestors.push(ancestorId);
    } else if (total === bestTotal && hitFrom.distance === best.up) {
      // Both parents of a full sibling are equally-near common ancestors.
      tiedAncestors.push(ancestorId);
    }
  }

  if (best) {
    const hitFrom = ancestorsOfFrom.get(best.ancestorId);
    const hitTo = ancestorsOfTo.get(best.ancestorId);
    /* c8 ignore next */
    if (!hitFrom || !hitTo) return empty(UNRELATED);

    const { up, down } = best;
    const side = sideFromParent(index, hitFrom.firstHopParentId);
    // The person one step below the common ancestor on the TARGET's side.
    // For a nibling that is my sibling; for a cousin it is my aunt or uncle.
    const linkPersonId = down >= 2 ? hitTo.via[down - 2] : toId;

    let descriptor: RelationshipDescriptor;

    if (up === 1 && down === 1) {
      const myParents = new Set(getParentEdges(index, fromId).map((e) => e.parent_id));
      const theirParents = new Set(getParentEdges(index, toId).map((e) => e.parent_id));
      let sharedCount = 0;
      for (const parentId of myParents) if (theirParents.has(parentId)) sharedCount += 1;
      const isHalf = sharedCount < myParents.size || sharedCount < theirParents.size;
      descriptor = {
        kind: 'sibling',
        up, down,
        half: isHalf,
        // Both parents shared means neither side dominates.
        side: isHalf ? side : 'both',
        targetGender,
        relativeAge: compareAges(index, fromId, toId),
      };
    } else if (up === 1) {
      // My sibling's child / grandchild.
      descriptor = {
        kind: 'nibling',
        up, down,
        removed: down - 2,
        side,
        targetGender,
        viaGender: genderOf(index, linkPersonId),
      };
    } else if (down === 1) {
      // My parent's sibling, or my grandparent's sibling (removed > 0).
      descriptor = {
        kind: 'pibling',
        up, down,
        removed: up - 2,
        side,
        targetGender,
        relativeAge: compareAges(index, fromId, toId),
      };
    } else {
      descriptor = {
        kind: 'cousin',
        up, down,
        degree: Math.min(up, down) - 1,
        removed: Math.abs(up - down),
        side,
        targetGender,
        // Which aunt/uncle the cousin comes through: Mongolian distinguishes
        // үеэл (through a paternal uncle) from бүл (through an aunt).
        viaGender: genderOf(index, linkPersonId),
        relativeAge: compareAges(index, fromId, toId),
      };
    }

    const upChain = hitFrom.via.slice(0, up);
    const downChain = hitTo.via.slice(0, down - 1).reverse();
    const nodes = [fromId, ...upChain, ...downChain, toId];
    const directions: Array<RelationshipStep['direction']> = [
      'self',
      ...upChain.map(() => 'up' as const),
      ...downChain.map(() => 'down' as const),
      'down',
    ];

    return {
      from: fromId,
      to: toId,
      descriptor,
      path: buildPath(index, nodes, directions, options),
      commonAncestorIds: tiedAncestors,
    };
  }

  // --- in-laws: related through a partner, on either side -------------------
  if (!options.shallow) {
    for (const couple of getCouples(index, fromId)) {
      const partnerId = couple.person_a_id === fromId ? couple.person_b_id : couple.person_a_id;
      if (!partnerId || partnerId === toId) continue;
      // Probe shallowly first (cheap, and cannot recurse back into in-laws),
      // then re-run with paths enabled only for the partner that actually hit.
      const probe = computeRelationship(index, partnerId, toId, { ...options, shallow: true });
      if (probe.descriptor.kind !== 'unrelated') {
        const viaPartner = computeRelationship(index, partnerId, toId, { ...options, shallow: false });
        return {
          from: fromId,
          to: toId,
          descriptor: {
            ...viaPartner.descriptor,
            kind: 'in_law',
            throughPartnerOf: partnerId,
            targetGender,
          },
          path: [
            { personId: fromId, direction: 'self', descriptor: { kind: 'self', up: 0, down: 0, side: 'unknown', targetGender: genderOf(index, fromId) } },
            { personId: partnerId, direction: 'partner', descriptor: { kind: 'partner', up: 0, down: 0, side: 'unknown', targetGender: genderOf(index, partnerId) } },
            ...viaPartner.path.slice(1),
          ],
          commonAncestorIds: viaPartner.commonAncestorIds,
        };
      }
    }

    for (const couple of getCouples(index, toId)) {
      const partnerId = couple.person_a_id === toId ? couple.person_b_id : couple.person_a_id;
      if (!partnerId || partnerId === fromId) continue;
      const probe = computeRelationship(index, fromId, partnerId, { ...options, shallow: true });
      if (probe.descriptor.kind !== 'unrelated') {
        const toPartner = computeRelationship(index, fromId, partnerId, { ...options, shallow: false });
        return {
          from: fromId,
          to: toId,
          descriptor: {
            ...toPartner.descriptor,
            kind: 'in_law',
            throughPartnerOf: partnerId,
            targetGender,
          },
          path: [
            ...toPartner.path,
            { personId: toId, direction: 'partner', descriptor: { kind: 'partner', up: 0, down: 0, side: 'unknown', targetGender } },
          ],
          commonAncestorIds: toPartner.commonAncestorIds,
        };
      }
    }
  }

  return empty({ ...UNRELATED, targetGender });
}

/**
 * Turn a list of person ids into displayable steps: YOU → Аав → Өвөө.
 * Each step carries its own descriptor so the UI can label every hop, which is
 * what makes the chain readable rather than a row of anonymous avatars.
 */
function buildPath(
  index: FamilyIndex,
  nodes: string[],
  directions: Array<RelationshipStep['direction']>,
  options: Options,
): RelationshipStep[] {
  if (options.shallow) return [];
  const fromId = nodes[0];
  /* c8 ignore next */
  if (!fromId) return [];

  return nodes.map((personId, i) => {
    const direction = directions[i] ?? 'up';
    if (i === 0) {
      return {
        personId,
        direction: 'self' as const,
        descriptor: { kind: 'self' as const, up: 0, down: 0, side: 'unknown' as const, targetGender: genderOf(index, personId) },
      };
    }
    // Recursion is bounded: this call cannot build a path of its own.
    const { descriptor } = computeRelationship(index, fromId, personId, { ...options, shallow: true });
    return { personId, direction, descriptor };
  });
}

/** All people in the family, ranked by how closely they are related. */
export function findRelatives(
  index: FamilyIndex,
  fromId: string,
  limit = 50,
): RelationshipResult[] {
  const results: RelationshipResult[] = [];
  for (const person of index.people.values()) {
    if (person.id === fromId) continue;
    const result = computeRelationship(index, fromId, person.id, { shallow: true });
    if (result.descriptor.kind === 'unrelated') continue;
    results.push(result);
  }
  results.sort((a, b) => {
    const distanceA = a.descriptor.up + a.descriptor.down;
    const distanceB = b.descriptor.up + b.descriptor.down;
    return distanceA - distanceB;
  });
  return results.slice(0, limit);
}
