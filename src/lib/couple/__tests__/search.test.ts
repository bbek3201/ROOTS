import { describe, expect, it } from 'vitest';
import { searchEntries, yearsPresent, type SearchableEntry } from '../search';

const entries: SearchableEntry[] = [
  { id: '1', kind: 'memory', title: 'Токио аялал', description: 'Тэнгисийн эрэг', place: 'Токио', mood: 'Аз жаргалтай', date: '2026-03-18' },
  { id: '2', kind: 'letter', title: 'Намайг санахдаа', description: null, place: null, mood: null, date: '2025-11-02' },
  { id: '3', kind: 'place', title: 'Улаанбаатар', description: null, place: 'Улаанбаатар', mood: null, date: '2025-06-12' },
  { id: '4', kind: 'voice', title: 'Анхны дуу хоолой', description: null, place: null, mood: null, date: null },
];

describe('searchEntries', () => {
  it('returns everything when nothing is asked', () => {
    expect(searchEntries(entries, {})).toHaveLength(4);
  });

  it('matches regardless of case', () => {
    expect(searchEntries(entries, { query: 'токио' }).map((e) => e.id)).toEqual(['1']);
    expect(searchEntries(entries, { query: 'ТОКИО' }).map((e) => e.id)).toEqual(['1']);
  });

  it('searches the story and the place, not only the title', () => {
    expect(searchEntries(entries, { query: 'тэнгис' }).map((e) => e.id)).toEqual(['1']);
    expect(searchEntries(entries, { query: 'улаанбаатар' }).map((e) => e.id)).toEqual(['3']);
  });

  it('searches the mood, so "аз жаргалтай" finds the day it was', () => {
    expect(searchEntries(entries, { query: 'жаргал' }).map((e) => e.id)).toEqual(['1']);
  });

  it('filters by kind', () => {
    expect(searchEntries(entries, { kinds: ['letter'] }).map((e) => e.id)).toEqual(['2']);
    expect(searchEntries(entries, { kinds: ['letter', 'place'] })).toHaveLength(2);
  });

  it('treats an empty kind list as "all", not as "none"', () => {
    expect(searchEntries(entries, { kinds: [] })).toHaveLength(4);
  });

  it('filters by year, and excludes entries with no date at all', () => {
    expect(searchEntries(entries, { year: 2025 }).map((e) => e.id)).toEqual(['2', '3']);
    expect(searchEntries(entries, { year: 2026 }).map((e) => e.id)).toEqual(['1']);
  });

  it('combines a query with a filter rather than choosing between them', () => {
    expect(searchEntries(entries, { query: 'а', kinds: ['place'] }).map((e) => e.id)).toEqual(['3']);
  });

  it('finds nothing gracefully', () => {
    expect(searchEntries(entries, { query: 'xyzzy' })).toEqual([]);
  });
});

describe('yearsPresent', () => {
  it('lists the years that have something in them, newest first', () => {
    expect(yearsPresent(entries)).toEqual([2026, 2025]);
  });

  it('ignores entries with no date', () => {
    expect(yearsPresent([entries[3]!])).toEqual([]);
  });
});
