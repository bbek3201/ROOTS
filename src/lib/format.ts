import type { DatePrecision } from '@/types/database';

/** Anything with a name. List queries select few columns; this accepts them. */
export interface NameLike {
  first_name: string;
  last_name?: string | null;
  nickname?: string | null;
}

/**
 * Mongolian names put the given name first and the father's name (овог) before
 * it in formal writing, but families say the given name. ROOTS displays the
 * given name and keeps the овог as secondary detail.
 */
export function displayName(person: NameLike | null | undefined): string {
  if (!person) return 'Тодорхойгүй';
  return person.first_name || 'Нэргүй';
}

export function fullName(person: NameLike | null | undefined): string {
  if (!person) return 'Тодорхойгүй';
  const parts = [person.last_name, person.first_name].filter(Boolean);
  return parts.join(' ') || 'Нэргүй';
}

export function initials(person: NameLike | null | undefined): string {
  const name = displayName(person);
  return name.slice(0, 1).toLocaleUpperCase('mn-MN');
}

/**
 * Dates in a family archive are frequently partial. Rendering "1961-01-01" for
 * "sometime in 1961" is a quiet lie, so precision decides the format.
 */
/**
 * Mongolian month names, written out rather than asked for.
 *
 * Chrome ships no Mongolian in its ICU data — `Intl.DateTimeFormat
 * .supportedLocalesOf(['mn-MN', 'mn'])` returns an empty array — so every
 * Intl call for 'mn-MN' in a browser silently resolves to en-US and renders
 * "March 18, 2026". Node's ICU is complete, so the same date came out
 * "2026 оны гуравдугаар сарын 18" on the server and in English the moment a
 * client component rendered it. Two different dates for one row.
 *
 * A table is thirteen lines and cannot fall back to somebody else's language.
 * ROOTS is Mongolian-first; its dates should not depend on a browser vendor
 * deciding to include the locale.
 */
const MN_MONTHS = [
  '1-р', '2-р', '3-р', '4-р', '5-р', '6-р',
  '7-р', '8-р', '9-р', '10-р', '11-р', '12-р',
] as const;

/**
 * Dates as a family writes them.
 *
 * Precision is carried rather than guessed: an archive is full of dates that
 * are honestly "1978" or "the sixties", and rendering those as 1 January is a
 * lie the interface tells on the family's behalf.
 */
export function formatDate(
  date: string | null | undefined,
  precision: DatePrecision = 'exact',
  locale = 'mn',
): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  const year = parsed.getUTCFullYear();
  const isMn = locale === 'mn' || locale.startsWith('mn-');

  switch (precision) {
    case 'year':
      return isMn ? `${year} он` : String(year);
    case 'decade':
      return isMn ? `${Math.floor(year / 10) * 10}-аад он` : `${Math.floor(year / 10) * 10}s`;
    case 'about':
      return isMn ? `${year} оны орчим` : `about ${year}`;
    case 'month':
      if (isMn) return `${year} оны ${MN_MONTHS[parsed.getUTCMonth()]} сар`;
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric', month: 'long', timeZone: 'UTC',
      }).format(parsed);
    case 'unknown':
      return isMn ? `${year} он (тодорхойгүй)` : `${year} (uncertain)`;
    case 'exact':
    default:
      if (isMn) {
        return `${year} оны ${MN_MONTHS[parsed.getUTCMonth()]} сарын ${parsed.getUTCDate()}`;
      }
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
      }).format(parsed);
  }
}

/**
 * Day and month, with the year left off.
 *
 * For a list that is already grouped under a year heading, repeating 2026 on
 * every row is noise the eye has to step over on the way to the day.
 */
export function formatDayMonth(date: string | null | undefined, locale = 'mn'): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  const isMn = locale === 'mn' || locale.startsWith('mn-');
  if (isMn) return `${MN_MONTHS[parsed.getUTCMonth()]} сарын ${parsed.getUTCDate()}`;

  return new Intl.DateTimeFormat(locale, {
    month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(parsed);
}

/**
 * The same date, short enough for a caption under a photograph.
 *
 * A gallery tile has room for a date and a place; "2026 оны 3-р сарын 18 ·
 * Токио, Япон" truncates to uselessness in that space, and a truncated date is
 * worse than a coarse one.
 */
export function formatDateShort(
  date: string | null | undefined,
  locale = 'mn',
): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  const isMn = locale === 'mn' || locale.startsWith('mn-');
  if (isMn) {
    return `${parsed.getUTCFullYear()}.${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(parsed);
}

export function yearOf(date: string | null | undefined): string {
  if (!date) return '';
  const year = date.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : '';
}

/** "1958 – 2019", "1958 –", or "" when nothing is known. */
export function lifespan(person: { birth_date: string | null; death_date: string | null }): string {
  const birth = yearOf(person.birth_date);
  const death = yearOf(person.death_date);
  if (!birth && !death) return '';
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `${birth} –`;
  return `– ${death}`;
}

export function ageAt(birthDate: string | null, referenceDate: string | null): number | null {
  if (!birthDate || !referenceDate) return null;
  const birth = new Date(birthDate);
  const reference = new Date(referenceDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime())) return null;
  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = reference.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

/**
 * Mongolian unit names, already in the genitive.
 *
 * Stored whole rather than built by appending a suffix: Mongolian vowel
 * harmony gives сар → сарын and минут → минутын, not сарийн and минутийн. A
 * single concatenated ending would be wrong in half these rows, and wrong in a
 * way only a Mongolian speaker would notice — which is everyone using this.
 */
const MN_UNITS: Record<string, string> = {
  year: 'жилийн', month: 'сарын', week: 'долоо хоногийн',
  day: 'хоногийн', hour: 'цагийн', minute: 'минутын',
};

const RELATIVE_THRESHOLDS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800],
  ['day', 86_400], ['hour', 3600], ['minute', 60],
];

/**
 * "3 хоногийн өмнө".
 *
 * Written out for Mongolian rather than asked of Intl.RelativeTimeFormat,
 * which — like Intl.DateTimeFormat — has no 'mn' in a browser's ICU and
 * silently answers in English. See the note on MN_MONTHS.
 */
export function relativeTime(iso: string, locale = 'mn', now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((then - now) / 1000);
  const isMn = locale === 'mn' || locale.startsWith('mn-');

  if (!isMn) {
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    for (const [unit, size] of RELATIVE_THRESHOLDS) {
      if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
    }
    return formatter.format(Math.round(seconds), 'second');
  }

  for (const [unit, size] of RELATIVE_THRESHOLDS) {
    if (Math.abs(seconds) < size) continue;
    const amount = Math.round(Math.abs(seconds) / size);
    const name = MN_UNITS[unit] ?? '';
    return seconds < 0 ? `${amount} ${name} өмнө` : `${amount} ${name} дараа`;
  }

  // Under a minute either way. Mongolian has a better word for this than
  // "0 секундын өмнө", which is what a units table would produce.
  return 'саяхан';
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
