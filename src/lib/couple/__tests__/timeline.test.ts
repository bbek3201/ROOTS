import { describe, expect, it } from 'vitest';
import { groupByYear, nextAnniversary, togetherFor, type TimelineEntry } from '../timeline';

const entry = (id: string, date: string): TimelineEntry => ({
  id, date, kind: 'memory', title: id, subtitle: null, href: '#', imageUrl: null,
});

describe('groupByYear', () => {
  it('puts the newest year first, and the earliest moment first inside it', () => {
    const years = groupByYear([
      entry('a', '2024-06-01'),
      entry('b', '2026-02-01'),
      entry('c', '2026-09-01'),
      entry('d', '2024-01-15'),
    ]);

    expect(years.map((year) => year.year)).toEqual([2026, 2024]);
    expect(years[0]!.entries.map((item) => item.id)).toEqual(['b', 'c']);
    expect(years[1]!.entries.map((item) => item.id)).toEqual(['d', 'a']);
  });

  it('drops entries with no usable year rather than inventing one', () => {
    expect(groupByYear([entry('a', ''), entry('b', 'nonsense')])).toEqual([]);
  });

  it('returns nothing for nothing', () => {
    expect(groupByYear([])).toEqual([]);
  });
});

describe('togetherFor', () => {
  const now = new Date('2026-09-04T12:00:00Z');

  it('counts years and months the way people say them', () => {
    expect(togetherFor('2025-06-12', now)).toBe('1 жил 2 сар');
    expect(togetherFor('2024-09-04', now)).toBe('2 жил');
    expect(togetherFor('2026-06-04', now)).toBe('3 сар');
  });

  it('does not count a month until the day comes round again', () => {
    // One day short of three months.
    expect(togetherFor('2026-06-05', now)).toBe('2 сар');
  });

  it('says something kind on the first day rather than "0 сар"', () => {
    expect(togetherFor('2026-09-04', now)).toBe('Шинэхэн эхэлж байна');
  });

  it('refuses a future start date instead of counting backwards', () => {
    expect(togetherFor('2030-01-01', now)).toBeNull();
  });

  it('has nothing to say without a date', () => {
    expect(togetherFor(null, now)).toBeNull();
  });
});

describe('nextAnniversary', () => {
  it('finds this year’s anniversary when it is still ahead', () => {
    const result = nextAnniversary('2020-12-25', new Date('2026-09-04T12:00:00Z'));
    expect(result?.date.getFullYear()).toBe(2026);
    expect(result?.years).toBe(6);
  });

  it('rolls to next year once it has passed', () => {
    const result = nextAnniversary('2020-06-12', new Date('2026-09-04T12:00:00Z'));
    expect(result?.date.getFullYear()).toBe(2027);
    expect(result?.years).toBe(7);
  });

  it('counts today as today, not as a year away', () => {
    const result = nextAnniversary('2020-09-04', new Date('2026-09-04T12:00:00Z'));
    expect(result?.daysAway).toBe(0);
    expect(result?.years).toBe(6);
  });

  it('has nothing to count down to without a start date', () => {
    expect(nextAnniversary(null)).toBeNull();
  });
});
