import type { FamilyIndex } from '@/lib/relationships/graph';
import { computeRelationship } from '@/lib/relationships/path';
import type { RelationshipResult } from '@/lib/relationships/types';
import { enKinship } from './en';
import { mnKinship } from './mn';
import type { KinshipLocale, KinshipTerm } from './types';

export type { KinshipLocale, KinshipTerm } from './types';
export { mnKinship } from './mn';
export { enKinship } from './en';

/**
 * The kinship locale registry.
 *
 * Mongolian is the default because ROOTS is Mongolian-first. Adding a language
 * means writing one KinshipLocale and registering it here — nothing in the
 * relationship engine, the tree or the database needs to change.
 */
const LOCALES: Record<string, KinshipLocale> = {
  mn: mnKinship,
  en: enKinship,
};

export const DEFAULT_LOCALE = 'mn';

export function getKinshipLocale(code: string | null | undefined): KinshipLocale {
  if (!code) return LOCALES[DEFAULT_LOCALE] as KinshipLocale;
  const exact = LOCALES[code];
  if (exact) return exact;
  // "mn-MN" should fall back to "mn" before it falls back to the default.
  const base = code.split('-')[0];
  return (base ? LOCALES[base] : undefined) ?? (LOCALES[DEFAULT_LOCALE] as KinshipLocale);
}

export function availableLocales(): KinshipLocale[] {
  return Object.values(LOCALES);
}

export interface NamedRelationship {
  result: RelationshipResult;
  term: KinshipTerm;
  /** One label per hop: ["Би", "Аав", "Өвөө", "Элэнц өвөө"]. */
  chain: Array<{ personId: string; term: KinshipTerm }>;
}

/**
 * Compute a relationship AND name it in one call — what the UI actually needs
 * when a user taps a person and asks "how am I related to them?".
 */
export function describeRelationship(
  index: FamilyIndex,
  fromId: string,
  toId: string,
  localeCode: string | null | undefined = DEFAULT_LOCALE,
): NamedRelationship {
  const locale = getKinshipLocale(localeCode);
  const result = computeRelationship(index, fromId, toId);
  return {
    result,
    term: locale.describe(result.descriptor),
    chain: result.path.map((step) => ({
      personId: step.personId,
      term: locale.describe(step.descriptor),
    })),
  };
}
