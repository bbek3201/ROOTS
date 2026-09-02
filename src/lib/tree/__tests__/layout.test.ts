import { describe, expect, it } from 'vitest';
import { buildFamilyIndex } from '@/lib/relationships/graph';
import { computeGenerations } from '@/lib/relationships/generation';
import { buildTestFamily, P, personId } from '@/lib/relationships/__tests__/fixture';
import { layoutFamilyTree, NODE_HEIGHT, ROW_HEIGHT } from '../layout';

/** The graph arrives from the database with generations already computed. */
function indexWithGenerations() {
  const graph = buildTestFamily();
  const index = buildFamilyIndex(graph);
  const generations = computeGenerations(index);
  for (const person of index.people.values()) {
    person.generation = generations.get(person.id) ?? 1;
  }
  return index;
}

const index = indexWithGenerations();
const layout = layoutFamilyTree(index);

describe('tree layout', () => {
  it('places every person exactly once', () => {
    expect(layout.personPositions.size).toBe(index.people.size);
  });

  it('draws a married-in partner inside their spouse’s unit', () => {
    // Саруул has no parents recorded, so she is a guest in Бат's unit rather
    // than floating as a root of her own.
    const batUnit = layout.unitByPerson.get(personId(P.bat));
    const saruulUnit = layout.unitByPerson.get(personId(P.saruul));
    expect(saruulUnit).toBe(batUnit);
  });

  it('keeps both of a person’s partners in the same unit', () => {
    const batUnit = layout.unitsById.get(layout.unitByPerson.get(personId(P.bat)) as string);
    expect(batUnit?.partners.map((partner) => partner.personId).sort()).toEqual(
      [personId(P.saruul), personId(P.tsetseg)].sort(),
    );
  });

  it('puts each generation on its own row', () => {
    const rowOf = (key: string) => layout.personPositions.get(personId(key))?.y;
    expect(rowOf(P.lhagva)).toBe(0);
    expect(rowOf(P.dorj)).toBe(ROW_HEIGHT);
    expect(rowOf(P.bat)).toBe(ROW_HEIGHT * 2);
    expect(rowOf(P.temuulen)).toBe(ROW_HEIGHT * 3);
    expect(rowOf(P.temuujin)).toBe(ROW_HEIGHT * 4);
  });

  it('puts partners on the same row as each other', () => {
    expect(layout.personPositions.get(personId(P.saruul))?.y)
      .toBe(layout.personPositions.get(personId(P.bat))?.y);
  });

  it('never overlaps two units on the same row', () => {
    const byRow = new Map<number, typeof layout.units>();
    for (const unit of layout.units) {
      const row = byRow.get(unit.y) ?? [];
      row.push(unit);
      byRow.set(unit.y, row);
    }

    for (const units of byRow.values()) {
      const sorted = [...units].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i += 1) {
        const previous = sorted[i - 1];
        const current = sorted[i];
        if (!previous || !current) continue;
        expect(current.x).toBeGreaterThanOrEqual(previous.x + previous.width);
      }
    }
  });

  it('centres parents over the span of their children', () => {
    const dorjUnitId = layout.unitByPerson.get(personId(P.dorj)) as string;
    const dorjUnit = layout.unitsById.get(dorjUnitId);
    expect(dorjUnit).toBeDefined();
    const children = (dorjUnit as NonNullable<typeof dorjUnit>).childUnitIds
      .map((id) => layout.unitsById.get(id))
      .filter((unit): unit is NonNullable<typeof unit> => unit !== undefined);

    const left = Math.min(...children.map((child) => child.x));
    const right = Math.max(...children.map((child) => child.x + child.width));
    const parentCentre = (dorjUnit as NonNullable<typeof dorjUnit>).x + (dorjUnit as NonNullable<typeof dorjUnit>).width / 2;

    expect(parentCentre).toBeGreaterThanOrEqual(left);
    expect(parentCentre).toBeLessThanOrEqual(right);
  });

  it('reports bounds that contain every node', () => {
    for (const position of layout.personPositions.values()) {
      expect(position.x).toBeGreaterThanOrEqual(layout.bounds.minX);
      expect(position.y + NODE_HEIGHT).toBeLessThanOrEqual(layout.bounds.maxY);
    }
  });

  it('restricts the tree to a generation window without losing the rest', () => {
    const windowed = layoutFamilyTree(index, { fromGeneration: 3, toGeneration: 5 });
    expect(windowed.generations).toEqual([3, 4, 5]);
    expect(windowed.personPositions.has(personId(P.lhagva))).toBe(false);
    // The people outside the window are simply not laid out — they are still in
    // the graph, and the archive still holds them.
    expect(index.people.has(personId(P.lhagva))).toBe(true);
  });

  it('is deterministic', () => {
    const again = layoutFamilyTree(index);
    for (const [personIdValue, position] of layout.personPositions) {
      expect(again.personPositions.get(personIdValue)).toEqual(position);
    }
  });
});
