import type { RelationshipDescriptor } from '@/lib/relationships/types';

/**
 * A named kinship term.
 *
 * `alternates` and `note` exist because kinship vocabulary genuinely varies —
 * between regions, between families, and between generations. ROOTS shows the
 * most widely used term but never pretends it is the only one, and never
 * silently invents a term it is not sure of: that is what `confidence` is for.
 */
export interface KinshipTerm {
  /** The term to display. */
  label: string;
  /** Other names the same relationship goes by. */
  alternates?: string[];
  /** Shown as a footnote when the term is regional or approximate. */
  note?: string;
  /**
   * standard — in general use and unambiguous
   * regional — attested, but varies by region or family
   * generic  — a descriptive fallback, not a real single word
   */
  confidence: 'standard' | 'regional' | 'generic';
}

export interface KinshipLocale {
  code: string;
  /** Endonym, e.g. "Монгол". */
  name: string;
  /** How the subject refers to themselves in a relationship chain. */
  self: string;
  unknown: KinshipTerm;
  describe(descriptor: RelationshipDescriptor): KinshipTerm;
}
