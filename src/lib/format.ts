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
export function formatDate(
  date: string | null | undefined,
  precision: DatePrecision = 'exact',
  locale = 'mn',
): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  const year = parsed.getUTCFullYear();

  switch (precision) {
    case 'year':
      return locale === 'mn' ? `${year} он` : String(year);
    case 'decade':
      return locale === 'mn' ? `${Math.floor(year / 10) * 10}-аад он` : `${Math.floor(year / 10) * 10}s`;
    case 'about':
      return locale === 'mn' ? `${year} оны орчим` : `about ${year}`;
    case 'month':
      return new Intl.DateTimeFormat(locale === 'mn' ? 'mn-MN' : locale, {
        year: 'numeric', month: 'long', timeZone: 'UTC',
      }).format(parsed);
    case 'unknown':
      return locale === 'mn' ? `${year} он (тодорхойгүй)` : `${year} (uncertain)`;
    case 'exact':
    default:
      return new Intl.DateTimeFormat(locale === 'mn' ? 'mn-MN' : locale, {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
      }).format(parsed);
  }
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

export function relativeTime(iso: string, locale = 'mn'): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((then - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale === 'mn' ? 'mn' : locale, { numeric: 'auto' });

  const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800],
    ['day', 86_400], ['hour', 3600], ['minute', 60],
  ];

  for (const [unit, size] of thresholds) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(Math.round(seconds), 'second');
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
