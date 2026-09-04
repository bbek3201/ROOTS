import { describe, expect, it } from 'vitest';
import { formatDate, formatDateShort, relativeTime } from '../format';

/**
 * These exist because the browser cannot help us here: Chrome ships no
 * Mongolian in its ICU data, so every one of these would silently be answered
 * in English by Intl. The tests assert the language, not the plumbing.
 */
describe('formatDate — Mongolian', () => {
  it('writes an exact date the way it is written', () => {
    expect(formatDate('2026-03-18', 'exact')).toBe('2026 оны 3-р сарын 18');
  });

  it('keeps a coarse date coarse rather than inventing a day', () => {
    expect(formatDate('1978-01-01', 'year')).toBe('1978 он');
    expect(formatDate('1965-01-01', 'decade')).toBe('1960-аад он');
    expect(formatDate('1978-01-01', 'about')).toBe('1978 оны орчим');
    expect(formatDate('1978-06-01', 'month')).toBe('1978 оны 6-р сар');
    expect(formatDate('1978-01-01', 'unknown')).toBe('1978 он (тодорхойгүй)');
  });

  it('never falls back to English', () => {
    for (const precision of ['exact', 'year', 'month', 'decade', 'about', 'unknown'] as const) {
      expect(formatDate('2026-03-18', precision)).not.toMatch(/[A-Za-z]/);
    }
  });

  it('reads the date in UTC, so a late-evening date does not slip a day', () => {
    expect(formatDate('2026-01-01', 'exact')).toBe('2026 оны 1-р сарын 1');
    expect(formatDate('2026-12-31', 'exact')).toBe('2026 оны 12-р сарын 31');
  });

  it('hands back nothing for nothing, and the input for nonsense', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('not a date');
  });

  it('still uses Intl for a locale the browser does have', () => {
    expect(formatDate('2026-03-18', 'exact', 'en')).toMatch(/March/);
  });
});

describe('formatDateShort', () => {
  it('is short enough for a caption under a photograph', () => {
    expect(formatDateShort('2026-03-18')).toBe('2026.03');
    expect(formatDateShort('2025-11-02')).toBe('2025.11');
  });

  it('pads the month, so the column does not jitter', () => {
    expect(formatDateShort('2026-01-05')).toBe('2026.01');
  });
});

describe('relativeTime — Mongolian', () => {
  const now = new Date('2026-09-04T12:00:00Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('declines the unit correctly rather than appending one ending to all of them', () => {
    expect(relativeTime(ago(3 * 86_400_000), 'mn', now)).toBe('3 хоногийн өмнө');
    expect(relativeTime(ago(70 * 86_400_000), 'mn', now)).toBe('2 сарын өмнө');
    expect(relativeTime(ago(3 * 3600_000), 'mn', now)).toBe('3 цагийн өмнө');
    expect(relativeTime(ago(5 * 60_000), 'mn', now)).toBe('5 минутын өмнө');
    expect(relativeTime(ago(400 * 86_400_000), 'mn', now)).toBe('1 жилийн өмнө');
  });

  it('has a word for "just now" rather than counting zero seconds', () => {
    expect(relativeTime(ago(4000), 'mn', now)).toBe('саяхан');
  });

  it('can also look forwards', () => {
    expect(relativeTime(new Date(now + 2 * 86_400_000).toISOString(), 'mn', now))
      .toBe('2 хоногийн дараа');
  });

  it('never falls back to English', () => {
    expect(relativeTime(ago(70 * 86_400_000), 'mn', now)).not.toMatch(/[A-Za-z]/);
  });

  it('hands back nothing for nonsense', () => {
    expect(relativeTime('not a date')).toBe('');
  });
});
