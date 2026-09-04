import type { CoupleFirstKey } from '@/types/database';

/**
 * The firsts, in the order they happen.
 *
 * A fixed vocabulary rather than free text, for one reason: the empty ones have
 * to be visible. A couple who has not written down their first photograph
 * should see a card asking for it, not an absence — the prompt is the feature,
 * and free-text rows can only ever show what somebody already remembered to
 * add.
 *
 * The order is the order of a relationship, not alphabetical, so the page reads
 * as a life rather than as a list.
 */
export interface FirstDefinition {
  key: CoupleFirstKey;
  label: string;
  /** Shown on an empty card. Never a placeholder — always a question. */
  prompt: string;
}

export const FIRSTS: readonly FirstDefinition[] = [
  { key: 'meeting',    label: 'Анх уулзсан',        prompt: 'Хаана, хэзээ анх тааралдсан бэ?' },
  { key: 'date',       label: 'Анхны болзоо',        prompt: 'Хамгийн анх хамт хаашаа явсан бэ?' },
  { key: 'photo',      label: 'Анхны хамтын зураг',  prompt: 'Хамтдаа авахуулсан хамгийн анхны зураг.' },
  { key: 'i_love_you', label: 'Анх хайртайгаа хэлсэн', prompt: 'Хэн нь эхэлж хэлсэн бэ?' },
  { key: 'trip',       label: 'Анхны аялал',         prompt: 'Хамтдаа хамгийн анх хаашаа явсан бэ?' },
  { key: 'gift',       label: 'Анхны бэлэг',         prompt: 'Юу байсан, яагаад тэр бэ?' },
  { key: 'movie',      label: 'Анх хамт үзсэн кино', prompt: 'Хамтдаа хамгийн анх юу үзсэн бэ?' },
  { key: 'home',       label: 'Анхны хамтын гэр',    prompt: 'Хамт амьдарч эхэлсэн газар.' },
  { key: 'anniversary',label: 'Анхны ойн баяр',      prompt: 'Эхний ойгоо хэрхэн тэмдэглэсэн бэ?' },
] as const;

const ORDER = new Map(FIRSTS.map((first, index) => [first.key, index]));

export function firstLabel(key: CoupleFirstKey): string {
  return FIRSTS.find((first) => first.key === key)?.label ?? key;
}

/**
 * Merge what a couple has filled in with the full list of prompts.
 *
 * Always returns all nine cards, in relationship order, filled or not. Rows
 * carrying a key this version does not know about are dropped rather than
 * appended: a client running older code should show fewer cards, never a card
 * it cannot label.
 */
export function mergeFirsts<T extends { key: string }>(
  saved: readonly T[],
): Array<FirstDefinition & { entry: T | null }> {
  const byKey = new Map(saved.map((row) => [row.key, row]));
  return [...FIRSTS]
    .sort((a, b) => (ORDER.get(a.key) ?? 0) - (ORDER.get(b.key) ?? 0))
    .map((definition) => ({ ...definition, entry: byKey.get(definition.key) ?? null }));
}

/** How much of the story is written down. Drives the gentle nudge on the card. */
export function firstsProgress(saved: readonly { key: string }[]): { filled: number; total: number } {
  const known = new Set(FIRSTS.map((first) => first.key as string));
  const filled = new Set(saved.map((row) => row.key).filter((key) => known.has(key)));
  return { filled: filled.size, total: FIRSTS.length };
}
