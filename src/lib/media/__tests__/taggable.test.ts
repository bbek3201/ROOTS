import { describe, expect, it } from 'vitest';
import { buildFamilyIndex } from '@/lib/relationships/graph';
import { taggablePeople } from '../taggable';
import { buildTestFamily } from '@/lib/relationships/__tests__/fixture';

const index = buildFamilyIndex(buildTestFamily());

describe('taggablePeople', () => {
  it('offers every living relative in the family', () => {
    const roster = taggablePeople(index);
    expect(roster.length).toBeGreaterThan(0);
    expect(new Set(roster.map((person) => person.id)).size).toBe(roster.length);
  });

  it('leaves archived people out — they were hidden on purpose', () => {
    const archived = [...index.people.values()][0]!;
    const withArchived = {
      ...index,
      people: new Map(index.people).set(archived.id, { ...archived, is_archived: true }),
    };

    const ids = taggablePeople(withArchived).map((person) => person.id);
    expect(ids).not.toContain(archived.id);
    expect(ids).toHaveLength(index.people.size - 1);
  });

  it('puts the living before the dead, so the common case is at the top', () => {
    const roster = taggablePeople(index);
    const deceased = new Set(
      [...index.people.values()].filter((p) => p.life_status === 'deceased').map((p) => p.id),
    );

    const firstDead = roster.findIndex((person) => deceased.has(person.id));
    const lastLiving = roster.map((person) => deceased.has(person.id)).lastIndexOf(false);
    if (firstDead !== -1) expect(firstDead).toBeGreaterThan(lastLiving);
  });

  it('carries the years, so two relatives with one name stay distinguishable', () => {
    const roster = taggablePeople(index);
    const withYears = roster.filter((person) => person.years !== null);
    expect(withYears.length).toBeGreaterThan(0);
    expect(withYears[0]!.years).toMatch(/\d{4}/);
  });
});
