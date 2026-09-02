/**
 * Core relationship graph types.
 *
 * These mirror the database exactly but are deliberately framework-free: the
 * whole relationship engine is pure functions over plain data, so it can be
 * unit-tested without a database, a browser or a network.
 */

export type GenderBucket = 'male' | 'female' | 'other' | 'unknown';
export type LifeStatus = 'living' | 'deceased' | 'unknown';
export type ParentChildType = 'biological' | 'adoptive' | 'step' | 'foster' | 'guardian' | 'unknown';
export type CoupleType = 'marriage' | 'partnership' | 'engagement' | 'unknown';
export type CoupleStatus = 'together' | 'separated' | 'divorced' | 'widowed' | 'ended' | 'unknown';

export interface PersonNode {
  id: string;
  first_name: string;
  last_name: string | null;
  nickname: string | null;
  gender: GenderBucket;
  birth_date: string | null;
  death_date: string | null;
  life_status: LifeStatus;
  /** Derived server-side from the graph; 1 = oldest known ancestor. */
  generation: number | null;
  is_archived: boolean;
  occupation: string | null;
  birth_place_id: string | null;
  profile_photo_media_id: string | null;
}

export interface CoupleNode {
  id: string;
  person_a_id: string;
  /** null means the partner is unknown — single parents stay representable. */
  person_b_id: string | null;
  relationship_type: CoupleType;
  status: CoupleStatus;
  marriage_date: string | null;
  relationship_start: string | null;
  relationship_end: string | null;
}

export interface ParentChildEdge {
  parent_id: string;
  child_id: string;
  /** Which couple the child was added through; drives full vs half siblings. */
  couple_id: string | null;
  relationship_type: ParentChildType;
}

export interface FamilyGraph {
  family_id: string;
  people: PersonNode[];
  couples: CoupleNode[];
  parent_child: ParentChildEdge[];
}

/** Which parental line a relationship travels through. */
export type LineageSide = 'paternal' | 'maternal' | 'both' | 'unknown';

export type RelationshipKind =
  | 'self'
  | 'partner'
  | 'ancestor'      // parent, grandparent, great-grandparent ...
  | 'descendant'    // child, grandchild ...
  | 'sibling'
  | 'pibling'       // parent's sibling: uncle / aunt
  | 'nibling'       // sibling's child: nephew / niece
  | 'cousin'
  | 'in_law'
  | 'step'
  | 'unrelated';

/**
 * A structural description of how two people are related, with no language in
 * it at all. Turning this into "Элэнц өвөө" or "great-grandfather" is the
 * kinship locale's job — which is what makes ROOTS translatable rather than
 * English-shaped with Mongolian labels bolted on.
 */
export interface RelationshipDescriptor {
  kind: RelationshipKind;
  /** Steps from the subject up to the nearest common ancestor. */
  up: number;
  /** Steps from that common ancestor down to the target. */
  down: number;
  /** Cousin degree: 1 = first cousin. Only meaningful when kind === 'cousin'. */
  degree?: number;
  /** Generational offset for cousins ("once removed"). */
  removed?: number;
  /** Half relationships share one parent, not two. */
  half?: boolean;
  side: LineageSide;
  /** Gender of the target — many kinship terms depend on it. */
  targetGender: GenderBucket;
  /**
   * Gender of the person the relationship travels through at the crucial hop.
   * Mongolian needs this: a son's child is ач, a daughter's child is зээ.
   */
  viaGender?: GenderBucket;
  /** Target is older/younger than the subject, where both birth dates are known. */
  relativeAge?: 'older' | 'younger' | 'unknown';
  /** Set when the link runs through a partner, e.g. "my wife's father". */
  throughPartnerOf?: string;
  /** Relationship type of the closest edge, so adoption is never erased. */
  edgeType?: ParentChildType;
}

/** One hop in the human-readable chain: YOU → Аав → Өвөө → Элэнц өвөө. */
export interface RelationshipStep {
  personId: string;
  /** Direction taken to REACH this person from the previous one. */
  direction: 'up' | 'down' | 'partner' | 'self';
  /** Structural descriptor of this person relative to the subject. */
  descriptor: RelationshipDescriptor;
}

export interface RelationshipResult {
  from: string;
  to: string;
  descriptor: RelationshipDescriptor;
  /** Full chain from subject to target, inclusive of both ends. */
  path: RelationshipStep[];
  /** Common ancestors that produced the shortest path, if any. */
  commonAncestorIds: string[];
}
