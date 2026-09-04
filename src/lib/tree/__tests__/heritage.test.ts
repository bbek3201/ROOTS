import { describe, expect, it } from 'vitest';
import { buildFamilyIndex } from '@/lib/relationships/graph';
import { buildTestFamily, P, personId } from '@/lib/relationships/__tests__/fixture';
import { buildAncestry, buildFromRoots, deeperCount } from '../heritage';

const index = buildFamilyIndex(buildTestFamily());

/**
 * The fixture, for reference:
 *   Лхагва ❤ Долгор → Дорж ❤ Цэрэн → Бат ❤ Саруул → Тэмүүлэн ❤ Хулан → Тэмүүжин
 * So walking up from Тэмүүжин should meet his parents, then Бат & Саруул,
 * then Дорж & Цэрэн.
 */
describe('buildAncestry', () => {
  it('starts with the viewer and their partner, not with the oldest ancestor', () => {
    const bands = buildAncestry(index, personId(P.temuulen));
    const first = bands[0]!.units[0]!;
    expect(first.people.map((p) => p.id)).toContain(personId(P.temuulen));
    expect(first.paired).toBe(true);
  });

  it('walks upward one generation per band', () => {
    const bands = buildAncestry(index, personId(P.temuujin), 3);
    expect(bands).toHaveLength(3);

    const ids = (depth: number) =>
      bands[depth]!.units.flatMap((unit) => unit.people.map((p) => p.id));

    expect(ids(0)).toEqual([personId(P.temuujin)]);
    expect(ids(1)).toEqual(expect.arrayContaining([personId(P.temuulen), personId(P.khulan)]));
    expect(ids(2)).toEqual(expect.arrayContaining([personId(P.bat), personId(P.saruul)]));
  });

  it('places each person exactly once, however many ways they are reachable', () => {
    const bands = buildAncestry(index, personId(P.temuujin), 5);
    const all = bands.flatMap((band) => band.units.flatMap((unit) => unit.people.map((p) => p.id)));
    expect(new Set(all).size).toBe(all.length);
  });

  it('stops when the line runs out rather than padding with empty bands', () => {
    const bands = buildAncestry(index, personId(P.lhagva), 4);
    expect(bands).toHaveLength(1);
    expect(bands[0]!.units[0]!.paired).toBe(true);
  });

  it('draws a person with no partner as a unit of one', () => {
    const bands = buildAncestry(index, personId(P.zul), 3);
    expect(bands).toHaveLength(1);
    expect(bands[0]!.units[0]!.paired).toBe(false);
    expect(bands[0]!.units[0]!.href).toBe(`/person/${personId(P.zul)}`);
  });

  it('links a pair to their couple page and a single person to their own', () => {
    const paired = buildAncestry(index, personId(P.temuulen))[0]!.units[0]!;
    expect(paired.href).toMatch(/^\/couple\//);
  });

  it('has nothing to show for a viewer ROOTS cannot place', () => {
    expect(buildAncestry(index, null)).toEqual([]);
    expect(buildAncestry(index, 'not-a-person')).toEqual([]);
  });

  it('honours the band limit', () => {
    expect(buildAncestry(index, personId(P.temuujin), 1)).toHaveLength(1);
    expect(buildAncestry(index, personId(P.temuujin), 2)).toHaveLength(2);
  });
});

describe('deeperCount', () => {
  it('counts the ancestors the bands have not reached yet', () => {
    const bands = buildAncestry(index, personId(P.temuujin), 2);
    // Бат, Саруул and everyone above them are still hidden at two bands.
    expect(deeperCount(index, bands)).toBeGreaterThan(0);
  });

  it('is zero once the bands reach the top, so the door is never onto nothing', () => {
    const bands = buildAncestry(index, personId(P.temuujin), 10);
    expect(deeperCount(index, bands)).toBe(0);
  });

  it('is zero for an empty tree', () => {
    expect(deeperCount(index, [])).toBe(0);
  });
});

describe('buildFromRoots', () => {
  it('gives a viewer ROOTS cannot place something to look at', () => {
    const bands = buildFromRoots(index, 3);
    expect(bands.length).toBeGreaterThan(0);
    expect(bands[0]!.units.length).toBeGreaterThan(0);
  });

  it('places each person exactly once here too', () => {
    const all = buildFromRoots(index, 5)
      .flatMap((band) => band.units.flatMap((unit) => unit.people.map((p) => p.id)));
    expect(new Set(all).size).toBe(all.length);
  });
});
