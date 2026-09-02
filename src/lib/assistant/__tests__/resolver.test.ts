import { describe, expect, it } from 'vitest';
import { buildFamilyIndex } from '@/lib/relationships/graph';
import { buildTestFamily, P, personId } from '@/lib/relationships/__tests__/fixture';
import { resolveFamilyQuestion } from '../resolver';

const index = buildFamilyIndex(buildTestFamily());

const ask = (question: string, subject = P.temuujin) =>
  resolveFamilyQuestion({ index, subjectPersonId: personId(subject), question, locale: 'mn' });

const askEn = (question: string, subject = P.temuujin) =>
  resolveFamilyQuestion({ index, subjectPersonId: personId(subject), question, locale: 'en' });

const names = (answer: ReturnType<typeof ask>) => answer.people.map((p) => p.first_name);

describe('the family assistant answers from the database, not from a model', () => {
  it('walks a chained question: my mother’s father', () => {
    // Тэмүүжин's mother is Хулан, who has no parents recorded — so this must
    // report "not recorded" rather than reaching for the nearest man.
    const answer = ask('Ээжийн минь аав хэн бэ?');
    expect(answer.needsAI).toBe(false);
    expect(answer.unknown).toBe(true);
  });

  it('walks my father’s father', () => {
    const answer = ask('Аавын минь аав хэн бэ?');
    expect(names(answer)).toEqual([P.bat]);
    expect(answer.needsAI).toBe(false);
  });

  it('answers "who is my great-grandmother"', () => {
    const answer = ask('Элэнц эмээ минь хэн бэ?');
    expect(names(answer)).toEqual([P.tseren]);
  });

  it('answers the same question in English', () => {
    const answer = askEn('Who is my great-grandfather?');
    expect(names(answer)).toEqual([P.dorj]);
  });

  it('lists a named person’s children', () => {
    const answer = ask('Доржийн хүүхдүүд хэн бэ?');
    expect(answer.intent).toBe('children');
    expect(names(answer).sort()).toEqual([P.bat, P.ganbat, P.oyun].sort());
  });

  it('reads "хүүхдүүд" as one word, not as "хүү" plus "дүү"', () => {
    // Substring matching used to take a second, invented hop through "дүү"
    // (younger sibling). Тэмүүлэн has exactly one child and that child has no
    // siblings, so the two readings give visibly different answers.
    const answer = ask('Тэмүүлэнгийн хүүхдүүд хэн бэ?');
    expect(names(answer)).toEqual([P.temuujin]);
    expect(answer.unknown).toBe(false);
  });

  it('handles Mongolian case endings on names', () => {
    // "Доржийн" must resolve to Дорж despite the genitive suffix.
    const answer = ask('Доржийн хүүхдүүд хэн бэ?');
    expect(answer.people.length).toBe(3);
  });

  it('explains how two people are related, with the full chain', () => {
    const answer = ask('Би Доржтой ямар хамааралтай вэ?');
    expect(answer.intent).toBe('relationship');
    expect(answer.facts[0]).toContain('Дорж');
    expect(answer.facts[1]).toBe('Би → Аав → Өвөө → Элэнц өвөө');
    expect(answer.unknown).toBe(false);
  });

  it('says plainly when two people have no recorded relationship', () => {
    const answer = ask('Би Зултай ямар хамааралтай вэ?');
    expect(answer.unknown).toBe(true);
    expect(answer.needsAI).toBe(false);
    expect(answer.facts[0]).toContain('олдсонгүй');
  });

  it('summarises a person from the graph when asked about them', () => {
    const answer = ask('Батын тухай ярьж өгөөч');
    expect(answer.intent).toBe('profile');
    const joined = answer.facts.join(' ');
    expect(joined).toContain(P.saruul);   // partner
    expect(joined).toContain(P.temuulen); // child
    expect(joined).toContain(P.dorj);     // parent
  });

  it('never guesses: an unparseable question is handed on, not answered', () => {
    const answer = ask('Тэнгэрийн од хэдэн вэ?');
    expect(answer.intent).toBe('unparsed');
    expect(answer.facts).toEqual([]);
    expect(answer.needsAI).toBe(true);
  });

  it('prefers the longer kinship term when two overlap', () => {
    // "элэнц өвөө" must not be read as the substring "өвөө".
    const answer = ask('Элэнц өвөө минь хэн бэ?');
    expect(names(answer)).toEqual([P.dorj]);
  });

  it('asks the user to identify themselves rather than guessing a subject', () => {
    const answer = resolveFamilyQuestion({
      index, subjectPersonId: null, question: 'Аав минь хэн бэ?', locale: 'mn',
    });
    expect(answer.people).toEqual([]);
    expect(answer.facts[0]).toContain('Профайл');
  });
});
