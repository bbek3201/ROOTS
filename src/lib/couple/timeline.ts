/**
 * One timeline out of everything a couple has kept.
 *
 * Memories, firsts, places, letters and voice notes are stored separately
 * because they are created, listed and secured differently. A relationship is
 * not lived that way — it is lived in order — so the timeline merges them back
 * into a single chronology.
 *
 * Deliberately a pure function over plain rows rather than a database view: a
 * view would have to union five tables with five different shapes and five
 * different privacy rules, and every future section would mean another
 * migration. This is one file, and it is unit-tested without a database.
 */

export type CoupleEntryKind = 'memory' | 'first' | 'place' | 'letter' | 'voice';

export interface TimelineEntry {
  id: string;
  kind: CoupleEntryKind;
  title: string;
  /** ISO date. Entries without one are not on the timeline at all. */
  date: string;
  subtitle: string | null;
  href: string;
  /** A signed URL, resolved by the caller. */
  imageUrl: string | null;
}

export interface TimelineYear {
  year: number;
  entries: TimelineEntry[];
}

/**
 * Group entries into years, newest year first, and oldest moment first inside
 * each year.
 *
 * The two orders differ on purpose. Scanning down the page you meet this year
 * before 2019, because that is what you came back for; but inside a year the
 * story runs forwards, because January then June then December is how the year
 * happened. A single direction would make one of those two readings wrong.
 */
export function groupByYear(entries: readonly TimelineEntry[]): TimelineYear[] {
  const byYear = new Map<number, TimelineEntry[]>();

  for (const entry of entries) {
    const year = Number(entry.date.slice(0, 4));
    if (!Number.isFinite(year) || year === 0) continue;
    const bucket = byYear.get(year) ?? [];
    bucket.push(entry);
    byYear.set(year, bucket);
  }

  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, list]) => ({
      year,
      entries: [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    }));
}

/**
 * How long they have been together, said the way people say it.
 *
 * Returns the WHOLE phrase, "хамт" included, so every caller can print it
 * verbatim. When two of them each appended their own "хамт" the home page read
 * "12 жил хамт хамт"; the word belongs here, once.
 */
export function togetherFor(startedOn: string | null, now = new Date()): string | null {
  if (!startedOn) return null;
  const start = new Date(startedOn);
  if (Number.isNaN(start.getTime()) || start > now) return null;

  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  // Not a full month until the day of the month has come round again.
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;

  const years = Math.floor(months / 12);
  const rest = months % 12;

  if (years === 0 && rest === 0) return 'Шинэхэн эхэлж байна';
  if (years === 0) return `${rest} сар хамт`;
  if (rest === 0) return `${years} жил хамт`;
  return `${years} жил ${rest} сар хамт`;
}

/**
 * The next anniversary, and how far away it is.
 *
 * Returns null rather than a negative number when there is no start date —
 * a countdown to nothing is worse than no countdown.
 */
export function nextAnniversary(
  startedOn: string | null,
  now = new Date(),
): { date: Date; daysAway: number; years: number } | null {
  if (!startedOn) return null;
  const start = new Date(startedOn);
  if (Number.isNaN(start.getTime())) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());

  const daysAway = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  return { date: next, daysAway, years: next.getFullYear() - start.getFullYear() };
}
