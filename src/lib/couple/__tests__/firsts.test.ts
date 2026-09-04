import { describe, expect, it } from 'vitest';
import { FIRSTS, firstLabel, firstsProgress, mergeFirsts } from '../firsts';

describe('mergeFirsts', () => {
  it('always returns every card, so the empty ones can ask their question', () => {
    expect(mergeFirsts([])).toHaveLength(FIRSTS.length);
    expect(mergeFirsts([]).every((card) => card.entry === null)).toBe(true);
  });

  it('attaches what has been written to the right card', () => {
    const merged = mergeFirsts([{ key: 'date', story: 'Хүрээлэнд' }]);
    const dateCard = merged.find((card) => card.key === 'date');
    expect(dateCard?.entry).toEqual({ key: 'date', story: 'Хүрээлэнд' });
    expect(merged.filter((card) => card.entry !== null)).toHaveLength(1);
  });

  it('keeps relationship order — meeting before anniversary, always', () => {
    const keys = mergeFirsts([]).map((card) => card.key);
    expect(keys.indexOf('meeting')).toBeLessThan(keys.indexOf('date'));
    expect(keys.indexOf('date')).toBeLessThan(keys.indexOf('anniversary'));
  });

  it('drops a key it cannot label rather than showing an unlabelled card', () => {
    const merged = mergeFirsts([{ key: 'first_argument' }]);
    expect(merged).toHaveLength(FIRSTS.length);
    expect(merged.some((card) => card.key === ('first_argument' as never))).toBe(false);
  });
});

describe('firstsProgress', () => {
  it('counts only the keys this version knows', () => {
    expect(firstsProgress([{ key: 'date' }, { key: 'gift' }, { key: 'nonsense' }]))
      .toEqual({ filled: 2, total: FIRSTS.length });
  });

  it('does not double-count a key written twice', () => {
    expect(firstsProgress([{ key: 'date' }, { key: 'date' }]).filled).toBe(1);
  });
});

describe('firstLabel', () => {
  it('falls back to the key rather than throwing on an unknown one', () => {
    expect(firstLabel('meeting')).toBe('Анх уулзсан');
    expect(firstLabel('unknown' as never)).toBe('unknown');
  });
});
