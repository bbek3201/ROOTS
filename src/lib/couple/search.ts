import type { CoupleEntryKind } from './timeline';

/**
 * Searching inside a couple's own archive.
 *
 * Runs in the browser over rows already loaded rather than as a database query,
 * and that is a deliberate choice rather than a shortcut: a couple's space is
 * small — hundreds of items, not the family's tens of thousands — and searching
 * it locally means typing feels instant and no query leaves the device.
 */
export interface SearchableEntry {
  id: string;
  kind: CoupleEntryKind;
  title: string;
  description: string | null;
  place: string | null;
  mood: string | null;
  date: string | null;
}

export interface SearchFilters {
  query?: string;
  /** Empty means every kind. */
  kinds?: readonly CoupleEntryKind[];
  year?: number | null;
}

/**
 * Case- and diacritic-insensitive, so "Токио" matches "токио" and "Ulaanbaatar"
 * matches "ulaanbaatar". Mongolian Cyrillic normalises under NFC; the fold is
 * applied to both sides so neither has to be stored in a particular form.
 */
function fold(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('mn');
}

export function searchEntries(
  entries: readonly SearchableEntry[],
  filters: SearchFilters,
): SearchableEntry[] {
  const needle = fold(filters.query?.trim() ?? '');
  const kinds = filters.kinds && filters.kinds.length > 0 ? new Set(filters.kinds) : null;

  return entries.filter((entry) => {
    if (kinds && !kinds.has(entry.kind)) return false;
    if (filters.year != null && Number(entry.date?.slice(0, 4)) !== filters.year) return false;
    if (!needle) return true;

    // Title, story, place and mood are all things a person would type in to
    // find a moment again — "Токио", "тэнгисийн эрэг", "аз жаргалтай".
    return [entry.title, entry.description, entry.place, entry.mood]
      .filter((field): field is string => Boolean(field))
      .some((field) => fold(field).includes(needle));
  });
}

/** Every year that has something in it, newest first — the year filter's options. */
export function yearsPresent(entries: readonly SearchableEntry[]): number[] {
  const years = new Set<number>();
  for (const entry of entries) {
    const year = Number(entry.date?.slice(0, 4));
    if (Number.isFinite(year) && year > 0) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}
