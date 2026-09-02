import { describe, expect, it } from 'vitest';
import { buildFamilyIndex, getSiblings, getGrandchildren, getCoupleChildren, getRootPeople } from '../graph';
import { computeGenerations, generationWindow } from '../generation';
import { computeRelationship, findRelatives } from '../path';
import { describeRelationship, getKinshipLocale } from '@/lib/kinship';
import { buildTestFamily, P, personId } from './fixture';

const index = buildFamilyIndex(buildTestFamily());
const mn = (from: string, to: string) => describeRelationship(index, personId(from), personId(to), 'mn').term.label;
const en = (from: string, to: string) => describeRelationship(index, personId(from), personId(to), 'en').term.label;
const rel = (from: string, to: string) => computeRelationship(index, personId(from), personId(to)).descriptor;

describe('generation calculation', () => {
  const generations = computeGenerations(index);
  const g = (key: string) => generations.get(personId(key));

  it('places the oldest known ancestor at generation 1', () => {
    expect(g(P.lhagva)).toBe(1);
  });

  it('places each child exactly one generation below its parents', () => {
    expect(g(P.dorj)).toBe(2);
    expect(g(P.bat)).toBe(3);
    expect(g(P.temuulen)).toBe(4);
    expect(g(P.temuujin)).toBe(5);
  });

  it('keeps a married-in partner on the same row as their spouse', () => {
    // This is the case a naive downward pass gets wrong: Саруул has no parents
    // recorded, so a descent-only algorithm would seed her at generation 1.
    expect(g(P.saruul)).toBe(g(P.bat));
    expect(g(P.tseren)).toBe(g(P.dorj));
    expect(g(P.khulan)).toBe(g(P.temuulen));
    expect(g(P.byamba)).toBe(g(P.oyun));
  });

  it('never places a person above their own parent', () => {
    for (const edge of buildTestFamily().parent_child) {
      const parent = generations.get(edge.parent_id);
      const child = generations.get(edge.child_id);
      expect(parent).toBeDefined();
      expect(child).toBeDefined();
      expect(child as number).toBeGreaterThan(parent as number);
    }
  });

  it('gives an unconnected person their own root generation', () => {
    expect(g(P.zul)).toBe(1);
  });
});

describe('the seven-generation window', () => {
  it('shows everything when the family is shallower than the window', () => {
    expect(generationWindow(3, 1, 5)).toEqual({ from: 1, to: 5, archivedAbove: 0, archivedBelow: 0 });
  });

  it('archives rather than discards older generations when the family is deeper', () => {
    const window = generationWindow(9, 1, 11, 7);
    expect(window.to - window.from + 1).toBe(7);
    expect(window.archivedAbove).toBeGreaterThan(0);
    // Nothing is lost — the archived count accounts for every generation.
    expect(window.archivedAbove + window.archivedBelow + 7).toBe(11);
  });

  it('never runs the window past the ends of the family', () => {
    const window = generationWindow(1, 1, 20, 7);
    expect(window.from).toBe(1);
    expect(window.to).toBe(7);
  });
});

describe('direct relations', () => {
  it('finds parents, children and partners', () => {
    expect(mn(P.temuujin, P.temuulen)).toBe('Аав');
    expect(mn(P.temuulen, P.temuujin)).toBe('Хүү');
    expect(mn(P.bat, P.saruul)).toBe('Эхнэр');
    expect(mn(P.saruul, P.bat)).toBe('Нөхөр');
  });

  it('walks seven generations of ancestors by name', () => {
    expect(mn(P.temuujin, P.bat)).toBe('Өвөө');
    expect(mn(P.temuujin, P.dorj)).toBe('Элэнц өвөө');
    expect(mn(P.temuujin, P.lhagva)).toBe('Хуланц өвөө');
    expect(mn(P.temuujin, P.dolgor)).toBe('Хуланц эмээ');
  });

  it('distinguishes the maternal grandparent line', () => {
    // Ану's mother is Оюун, so Дорж is reached through the mother: нагац өвөө.
    expect(mn(P.anu, P.dorj)).toBe('Нагац өвөө');
    // Тэмүүжин's father is Тэмүүлэн, so the same man is plain өвөө for Бат.
    expect(mn(P.temuujin, P.bat)).toBe('Өвөө');
  });
});

describe('ач vs зээ — descent through a son or a daughter', () => {
  it('names a son’s son ач хүү', () => {
    expect(mn(P.bat, P.temuujin)).toBe('Ач хүү');
  });

  it('names a daughter’s daughter зээ охин', () => {
    expect(mn(P.bat, P.sarnai)).toBe('Зээ охин');
  });

  it('records which line the descent travelled through', () => {
    expect(rel(P.bat, P.temuujin).viaGender).toBe('male');
    expect(rel(P.bat, P.sarnai).viaGender).toBe('female');
  });

  it('flattens both into "grandchild" in English, as English does', () => {
    expect(en(P.bat, P.temuujin)).toBe('Grandson');
    expect(en(P.bat, P.sarnai)).toBe('Granddaughter');
  });
});

describe('siblings', () => {
  it('names siblings by relative age, as Mongolian requires', () => {
    expect(mn(P.nomin, P.temuulen)).toBe('Ах');       // older brother
    expect(mn(P.temuulen, P.nomin)).toBe('Дүү охин'); // younger sister
  });

  it('separates full siblings from half siblings', () => {
    const full = getSiblings(index, personId(P.temuulen));
    expect(full.full.map((p) => p.first_name)).toEqual([P.nomin]);
    expect(full.half.map((p) => p.first_name)).toEqual([P.munkh]);
  });

  it('marks a half sibling in the term itself', () => {
    expect(rel(P.temuulen, P.munkh).half).toBe(true);
    expect(rel(P.temuulen, P.nomin).half).toBe(false);
    expect(en(P.temuulen, P.munkh)).toBe('Half-brother');
  });
});

describe('авга and нагац — the paternal and maternal lines', () => {
  it('names a father’s sister авга эгч', () => {
    expect(mn(P.temuulen, P.oyun)).toBe('Авга эгч');
  });

  it('names a mother’s brother нагац ах', () => {
    expect(mn(P.anu, P.bat)).toBe('Нагац ах');
  });

  it('collapses both to uncle/aunt in English', () => {
    expect(en(P.temuulen, P.oyun)).toBe('Aunt');
    expect(en(P.anu, P.bat)).toBe('Uncle');
  });
});

describe('cousins and niblings', () => {
  it('identifies first cousins', () => {
    const descriptor = rel(P.temuulen, P.anu);
    expect(descriptor.kind).toBe('cousin');
    expect(descriptor.degree).toBe(1);
    expect(descriptor.removed).toBe(0);
    expect(en(P.temuulen, P.anu)).toBe('First cousin');
  });

  it('counts generational offset for cousins once removed', () => {
    const descriptor = rel(P.anu, P.temuujin);
    expect(descriptor.kind).toBe('cousin');
    expect(descriptor.degree).toBe(1);
    expect(descriptor.removed).toBe(1);
    expect(en(P.anu, P.temuujin)).toBe('First cousin, once removed');
  });

  it('names a brother’s child ач and a sister’s child зээ', () => {
    expect(mn(P.nomin, P.temuujin)).toBe('Ач хүү');   // brother Тэмүүлэн's son
    expect(mn(P.temuulen, P.sarnai)).toBe('Зээ охин'); // sister Номин's daughter
  });
});

describe('relatives by marriage', () => {
  it('names a partner’s father хадам аав', () => {
    expect(mn(P.saruul, P.dorj)).toBe('Хадам аав');
    expect(en(P.saruul, P.dorj)).toBe('Father-in-law');
  });

  it('names a son’s wife бэр', () => {
    expect(mn(P.bat, P.khulan)).toBe('Бэр');
  });

  it('does not treat an in-law as a blood relative', () => {
    expect(rel(P.saruul, P.dorj).kind).toBe('in_law');
  });
});

describe('unknown is a real answer', () => {
  it('reports no relationship rather than inventing one', () => {
    expect(rel(P.bat, P.zul).kind).toBe('unrelated');
    expect(mn(P.bat, P.zul)).toBe('Тодорхойгүй');
    expect(en(P.bat, P.zul)).toBe('Unknown');
  });

  it('returns unrelated for people who are not in the family at all', () => {
    const result = computeRelationship(index, personId(P.bat), 'not-a-real-id');
    expect(result.descriptor.kind).toBe('unrelated');
    expect(result.path).toEqual([]);
  });
});

describe('the relationship path a user actually sees', () => {
  it('spells out YOU → Аав → Өвөө → Элэнц өвөө', () => {
    const named = describeRelationship(index, personId(P.temuujin), personId(P.dorj), 'mn');
    expect(named.chain.map((step) => step.term.label)).toEqual(['Би', 'Аав', 'Өвөө', 'Элэнц өвөө']);
  });

  it('routes a collateral path up through the common ancestor and back down', () => {
    const named = describeRelationship(index, personId(P.temuulen), personId(P.anu), 'mn');
    const names = named.result.path.map((step) => index.people.get(step.personId)?.first_name);
    expect(names).toEqual([P.temuulen, P.bat, P.dorj, P.oyun, P.anu]);
  });

  it('shows the partner hop when the link runs through marriage', () => {
    const named = describeRelationship(index, personId(P.saruul), personId(P.dorj), 'mn');
    const names = named.result.path.map((step) => index.people.get(step.personId)?.first_name);
    expect(names).toEqual([P.saruul, P.bat, P.dorj]);
  });

  it('reports the common ancestors that produced the link', () => {
    const result = computeRelationship(index, personId(P.temuulen), personId(P.anu));
    const names = result.commonAncestorIds.map((id) => index.people.get(id)?.first_name).sort();
    expect(names).toEqual([P.dorj, P.tseren].sort());
  });
});

describe('graph helpers used by the tree and profiles', () => {
  it('lists a couple’s children oldest first', () => {
    const children = getCoupleChildren(index, personId('c1')).map((p) => p.first_name);
    expect(children).toEqual([P.bat, P.oyun, P.ganbat]);
  });

  it('collects grandchildren across every child', () => {
    const grandchildren = getGrandchildren(index, personId(P.dorj)).map((p) => p.first_name).sort();
    expect(grandchildren).toEqual([P.anu, P.munkh, P.nomin, P.temuulen].sort());
  });

  it('finds the people the family history starts from', () => {
    const roots = getRootPeople(index).map((p) => p.first_name);
    expect(roots).toContain(P.lhagva);
    expect(roots).not.toContain(P.dorj);
  });

  it('ranks relatives by closeness', () => {
    const relatives = findRelatives(index, personId(P.temuulen), 5);
    expect(relatives[0]).toBeDefined();
    const closest = relatives.slice(0, 4).map((r) => index.people.get(r.to)?.first_name);
    expect(closest).toContain(P.bat);
    expect(closest).toContain(P.saruul);
  });
});

describe('kinship locale registry', () => {
  it('falls back from a region tag to its base language', () => {
    expect(getKinshipLocale('mn-MN').code).toBe('mn');
    expect(getKinshipLocale('en-GB').code).toBe('en');
  });

  it('defaults to Mongolian, the first-class language of this product', () => {
    expect(getKinshipLocale(null).code).toBe('mn');
    expect(getKinshipLocale('zz').code).toBe('mn');
  });

  it('flags terms whose usage genuinely varies instead of asserting them', () => {
    const deep = describeRelationship(index, personId(P.temuujin), personId(P.lhagva), 'mn');
    expect(deep.term.confidence).toBe('standard');
    // A cousin through an aunt is the regionally variable case.
    const cousin = describeRelationship(index, personId(P.temuulen), personId(P.anu), 'mn');
    expect(['regional', 'generic', 'standard']).toContain(cousin.term.confidence);
    expect(cousin.term.alternates?.length ?? 0).toBeGreaterThan(0);
  });
});
