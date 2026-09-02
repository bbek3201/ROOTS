import {
  getChildren,
  getParents,
  getPartners,
  getSiblings,
  type FamilyIndex,
} from '@/lib/relationships/graph';
import { computeRelationship } from '@/lib/relationships/path';
import { getKinshipLocale } from '@/lib/kinship';
import { displayName, lifespan } from '@/lib/format';
import type { GroundingRef } from '@/lib/ai/types';
import type { PersonNode } from '@/lib/relationships/types';

/**
 * The family assistant's database-first resolver.
 *
 * This answers "Who was my mother's father?" with a graph walk, not a language
 * model. AI is only reached for questions this cannot parse — which is the
 * right split: relationships, ids, dates and permissions are exact, and asking
 * a probabilistic system to compute them is how wrong answers get into a
 * permanent archive.
 *
 * It is also the reason ROOTS answers instantly and works with no API key.
 */

export type QuestionIntent = 'kinship_walk' | 'relationship' | 'profile' | 'children' | 'unparsed';

export interface ResolvedAnswer {
  intent: QuestionIntent;
  /** Human-readable facts, already in the user's language. */
  facts: string[];
  /** People the answer points at, for rendering result cards. */
  people: PersonNode[];
  grounding: GroundingRef[];
  /** True when the graph could not answer and AI phrasing may help. */
  needsAI: boolean;
  /** True when the archive genuinely has no answer. Never fill this with AI. */
  unknown: boolean;
}

/** One hop in a chained question like "my mother's father". */
interface KinshipStep {
  kind: 'parent' | 'child' | 'sibling' | 'partner' | 'grandparent' | 'grandchild';
  gender?: 'male' | 'female';
  /** Extra generations up, e.g. great-grandfather = grandparent + 1. */
  extraUp?: number;
}

/**
 * Kinship vocabulary for QUESTIONS, kept separate from display terminology.
 * Stems only — Mongolian is agglutinative, so "ээжийн", "ээжийг" and "ээжээс"
 * all begin with "ээж" and prefix matching handles the case endings.
 */
const STEP_TERMS: Array<{ stems: string[]; step: KinshipStep }> = [
  // Mongolian
  { stems: ['аав', 'эцэг'], step: { kind: 'parent', gender: 'male' } },
  { stems: ['ээж', 'эх'], step: { kind: 'parent', gender: 'female' } },
  { stems: ['эцэг эх', 'эцэг, эх'], step: { kind: 'parent' } },
  { stems: ['элэнц өвөө'], step: { kind: 'grandparent', gender: 'male', extraUp: 1 } },
  { stems: ['элэнц эмээ'], step: { kind: 'grandparent', gender: 'female', extraUp: 1 } },
  { stems: ['хуланц өвөө'], step: { kind: 'grandparent', gender: 'male', extraUp: 2 } },
  { stems: ['хуланц эмээ'], step: { kind: 'grandparent', gender: 'female', extraUp: 2 } },
  { stems: ['өвөө'], step: { kind: 'grandparent', gender: 'male' } },
  { stems: ['эмээ'], step: { kind: 'grandparent', gender: 'female' } },
  // 'хүүхд' covers the plural 'хүүхдүүд'; it must be listed because Mongolian
  // pluralisation changes the stem, and prefix matching alone would not reach it.
  { stems: ['үр хүүхэд', 'хүүхэд', 'хүүхд'], step: { kind: 'child' } },
  { stems: ['охид', 'охин'], step: { kind: 'child', gender: 'female' } },
  { stems: ['хөвгүүд', 'хүү'], step: { kind: 'child', gender: 'male' } },
  { stems: ['ач', 'зээ'], step: { kind: 'grandchild' } },
  { stems: ['ах'], step: { kind: 'sibling', gender: 'male' } },
  { stems: ['эгч'], step: { kind: 'sibling', gender: 'female' } },
  { stems: ['дүү', 'ах дүү'], step: { kind: 'sibling' } },
  { stems: ['эхнэр'], step: { kind: 'partner', gender: 'female' } },
  { stems: ['нөхөр'], step: { kind: 'partner', gender: 'male' } },
  { stems: ['хань'], step: { kind: 'partner' } },
  // English
  { stems: ['great-grandfather', 'great grandfather'], step: { kind: 'grandparent', gender: 'male', extraUp: 1 } },
  { stems: ['great-grandmother', 'great grandmother'], step: { kind: 'grandparent', gender: 'female', extraUp: 1 } },
  { stems: ['grandfather'], step: { kind: 'grandparent', gender: 'male' } },
  { stems: ['grandmother'], step: { kind: 'grandparent', gender: 'female' } },
  { stems: ['grandparent'], step: { kind: 'grandparent' } },
  { stems: ['grandchild', 'grandson', 'granddaughter'], step: { kind: 'grandchild' } },
  { stems: ['father', 'dad'], step: { kind: 'parent', gender: 'male' } },
  { stems: ['mother', 'mum', 'mom'], step: { kind: 'parent', gender: 'female' } },
  { stems: ['parents', 'parent'], step: { kind: 'parent' } },
  { stems: ['children', 'child', 'kids'], step: { kind: 'child' } },
  { stems: ['daughter'], step: { kind: 'child', gender: 'female' } },
  { stems: ['son'], step: { kind: 'child', gender: 'male' } },
  { stems: ['brother'], step: { kind: 'sibling', gender: 'male' } },
  { stems: ['sister'], step: { kind: 'sibling', gender: 'female' } },
  { stems: ['sibling', 'siblings'], step: { kind: 'sibling' } },
  { stems: ['wife'], step: { kind: 'partner', gender: 'female' } },
  { stems: ['husband'], step: { kind: 'partner', gender: 'male' } },
  { stems: ['partner', 'spouse'], step: { kind: 'partner' } },
];

const RELATIONSHIP_MARKERS = [
  'ямар хамаарал', 'ямар холбоо', 'яаж хамаарал', 'хэн болох',
  'how am i related', 'how are we related', 'relation to', 'related to',
];

const PROFILE_MARKERS = ['тухай', 'танилцуул', 'ярьж өгөөч', 'tell me about', 'who is', 'about my'];

function normalise(text: string): string {
  return text.toLocaleLowerCase('mn-MN').replace(/\s+/g, ' ').trim();
}

/**
 * Find people named in the question.
 *
 * Matches on a stem so Mongolian case endings ("Доржийн", "Доржтой") still
 * resolve to Дорж. Longest names are matched first so "Бат-Эрдэнэ" is not
 * mistaken for "Бат".
 */
function findNamedPeople(index: FamilyIndex, question: string): PersonNode[] {
  const lowered = normalise(question);
  const candidates: Array<{ person: PersonNode; length: number }> = [];

  for (const person of index.people.values()) {
    for (const raw of [person.first_name, person.nickname, person.last_name]) {
      if (!raw) continue;
      const name = normalise(raw);
      if (name.length < 2) continue;
      // Word must START with the name, so "аав" never matches inside another word.
      const pattern = new RegExp(`(^|[^\\p{L}])${escapeRegExp(name)}\\p{L}{0,6}([^\\p{L}]|$)`, 'u');
      if (pattern.test(lowered)) {
        candidates.push({ person, length: name.length });
        break;
      }
    }
  }

  return candidates.sort((a, b) => b.length - a.length).map((entry) => entry.person);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Read the kinship terms out of the question, in the order they appear.
 *
 * Matching is WORD-ANCHORED, not substring: Mongolian attaches suffixes at the
 * end of a word, so a term must begin one. Substring matching looked fine until
 * "хүүхдүүд" ("children") matched both "хүү" (son) and "дүү" (younger sibling)
 * and silently answered a different question than the one asked.
 *
 * Longer terms win, so "элэнц өвөө" is never read as "өвөө" and "эхнэр" (wife)
 * is never read as "эх" (mother).
 */
const FLAT_TERMS: Array<{ stem: string; words: number; step: KinshipStep }> = STEP_TERMS
  .flatMap((entry) => entry.stems.map((stem) => ({
    stem,
    words: stem.split(' ').length,
    step: entry.step,
  })))
  .sort((a, b) => b.stem.length - a.stem.length);

function parseSteps(question: string): KinshipStep[] {
  // Keep hyphens so "great-grandfather" survives as one word.
  const words = normalise(question).split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
  const steps: KinshipStep[] = [];

  let position = 0;
  while (position < words.length) {
    const match = FLAT_TERMS.find((term) => {
      const phrase = words.slice(position, position + term.words).join(' ');
      return phrase.startsWith(term.stem);
    });

    if (match) {
      steps.push(match.step);
      position += match.words;
    } else {
      position += 1;
    }
  }

  return steps;
}

function applyStep(index: FamilyIndex, people: PersonNode[], step: KinshipStep): PersonNode[] {
  const results = new Map<string, PersonNode>();

  for (const person of people) {
    let reached: PersonNode[] = [];

    switch (step.kind) {
      case 'parent':
        reached = getParents(index, person.id);
        break;
      case 'child':
        reached = getChildren(index, person.id);
        break;
      case 'sibling':
        reached = [...getSiblings(index, person.id).full, ...getSiblings(index, person.id).half];
        break;
      case 'partner':
        reached = getPartners(index, person.id);
        break;
      case 'grandparent': {
        reached = getParents(index, person.id).flatMap((parent) => getParents(index, parent.id));
        // "great-grandparent" is a grandparent walk with extra hops up.
        for (let extra = 0; extra < (step.extraUp ?? 0); extra += 1) {
          reached = reached.flatMap((ancestor) => getParents(index, ancestor.id));
        }
        break;
      }
      case 'grandchild': {
        reached = getChildren(index, person.id).flatMap((child) => getChildren(index, child.id));
        for (let extra = 0; extra < (step.extraUp ?? 0); extra += 1) {
          reached = reached.flatMap((descendant) => getChildren(index, descendant.id));
        }
        break;
      }
    }

    for (const found of reached) {
      if (step.gender && found.gender !== step.gender) continue;
      results.set(found.id, found);
    }
  }

  return [...results.values()];
}

export interface ResolveOptions {
  index: FamilyIndex;
  /** The person the asker IS, so "my father" has a starting point. */
  subjectPersonId: string | null;
  question: string;
  locale?: string;
}

export function resolveFamilyQuestion(options: ResolveOptions): ResolvedAnswer {
  const { index, subjectPersonId, question, locale = 'mn' } = options;
  const kinship = getKinshipLocale(locale);
  const lowered = normalise(question);

  const named = findNamedPeople(index, question);
  const steps = parseSteps(question);

  const emptyAnswer = (intent: QuestionIntent, facts: string[], needsAI = false): ResolvedAnswer => ({
    intent, facts, people: [], grounding: [], needsAI, unknown: facts.length === 0,
  });

  // --- "How am I related to Dorj?" -----------------------------------------
  if (RELATIONSHIP_MARKERS.some((marker) => lowered.includes(marker))) {
    const target = named[0];
    if (!subjectPersonId) {
      return emptyAnswer('relationship', [
        locale === 'mn'
          ? 'Та өөрийгөө гэр бүлийн модонд холбоогүй байна. Профайл хэсгээс өөрийгөө сонгоно уу.'
          : 'You are not linked to a person in the tree yet. Choose yourself in Profile.',
      ]);
    }
    if (!target) {
      return emptyAnswer('relationship', [], true);
    }

    const result = computeRelationship(index, subjectPersonId, target.id);
    if (result.descriptor.kind === 'unrelated') {
      return {
        intent: 'relationship',
        facts: [
          locale === 'mn'
            ? `${displayName(target)}-тай холбогдох хамаарал хадгалагдсан мэдээллээс олдсонгүй.`
            : `No recorded relationship to ${displayName(target)} was found.`,
        ],
        people: [target],
        grounding: [{ type: 'person', id: target.id, label: displayName(target) }],
        needsAI: false,
        unknown: true,
      };
    }

    const term = kinship.describe(result.descriptor);
    const chain = result.path
      .map((step, position) => (position === 0 ? kinship.self : kinship.describe(step.descriptor).label))
      .join(' → ');
    const names = result.path.map((step) => displayName(index.people.get(step.personId))).join(' → ');

    return {
      intent: 'relationship',
      facts: [
        locale === 'mn'
          ? `${displayName(target)} бол таны ${term.label.toLocaleLowerCase('mn-MN')}.`
          : `${displayName(target)} is your ${term.label.toLowerCase()}.`,
        chain,
        names,
        ...(term.note ? [term.note] : []),
      ],
      people: [target],
      grounding: result.path.map((step) => ({
        type: 'person' as const,
        id: step.personId,
        label: displayName(index.people.get(step.personId)),
      })),
      needsAI: false,
      unknown: false,
    };
  }

  // --- kinship walks: "my mother's father", "Dorj's children" ---------------
  if (steps.length > 0) {
    const startPerson = named[0] ?? (subjectPersonId ? index.people.get(subjectPersonId) : undefined);
    if (!startPerson) {
      return emptyAnswer('kinship_walk', [
        locale === 'mn'
          ? 'Хэнээс эхлэхээ тодорхойлж чадсангүй. Профайл хэсгээс өөрийгөө холбоно уу.'
          : 'I could not tell who to start from. Link yourself to a person in Profile.',
      ]);
    }

    let current: PersonNode[] = [startPerson];
    for (const step of steps) {
      current = applyStep(index, current, step);
      if (current.length === 0) break;
    }

    if (current.length === 0) {
      return {
        intent: steps.some((step) => step.kind === 'child') ? 'children' : 'kinship_walk',
        facts: [
          locale === 'mn'
            ? 'Энэ хүн архивт бүртгэгдээгүй байна. Мэдэх хүнээсээ асууж нэмж болно.'
            : 'That person is not recorded in the archive yet.',
        ],
        people: [],
        grounding: [{ type: 'person', id: startPerson.id, label: displayName(startPerson) }],
        needsAI: false,
        unknown: true,
      };
    }

    return {
      intent: steps.some((step) => step.kind === 'child') ? 'children' : 'kinship_walk',
      facts: current.map((person) => describePerson(person, locale)),
      people: current,
      grounding: current.map((person) => ({
        type: 'person' as const, id: person.id, label: displayName(person),
      })),
      needsAI: false,
      unknown: false,
    };
  }

  // --- "Tell me about my grandfather" --------------------------------------
  if (PROFILE_MARKERS.some((marker) => lowered.includes(marker)) && named[0]) {
    const person = named[0];
    return {
      intent: 'profile',
      facts: profileFacts(index, person, locale),
      people: [person],
      grounding: [{ type: 'person', id: person.id, label: displayName(person) }],
      needsAI: false,
      unknown: false,
    };
  }

  // A named person with no recognisable question shape still deserves an answer.
  if (named[0]) {
    const person = named[0];
    return {
      intent: 'profile',
      facts: profileFacts(index, person, locale),
      people: [person],
      grounding: [{ type: 'person', id: person.id, label: displayName(person) }],
      needsAI: false,
      unknown: false,
    };
  }

  // Nothing matched. AI may be able to phrase it — but only from facts we give it.
  return emptyAnswer('unparsed', [], true);
}

function describePerson(person: PersonNode, locale: string): string {
  const years = lifespan(person);
  const parts = [displayName(person)];
  if (years) parts.push(`(${years})`);
  if (person.occupation) parts.push(`— ${person.occupation}`);
  void locale;
  return parts.join(' ');
}

/** A short factual profile, assembled from the graph — no AI involved. */
function profileFacts(index: FamilyIndex, person: PersonNode, locale: string): string[] {
  const mn = locale === 'mn';
  const facts: string[] = [describePerson(person, locale)];

  const parents = getParents(index, person.id);
  if (parents.length > 0) {
    facts.push(`${mn ? 'Эцэг эх' : 'Parents'}: ${parents.map((p) => displayName(p)).join(', ')}`);
  }

  const partners = getPartners(index, person.id);
  if (partners.length > 0) {
    facts.push(`${mn ? 'Хань' : 'Partner'}: ${partners.map((p) => displayName(p)).join(', ')}`);
  }

  const children = getChildren(index, person.id);
  if (children.length > 0) {
    facts.push(`${mn ? 'Хүүхдүүд' : 'Children'}: ${children.map((p) => displayName(p)).join(', ')}`);
  }

  const siblings = getSiblings(index, person.id);
  const allSiblings = [...siblings.full, ...siblings.half];
  if (allSiblings.length > 0) {
    facts.push(`${mn ? 'Ах дүү' : 'Siblings'}: ${allSiblings.map((p) => displayName(p)).join(', ')}`);
  }

  if (facts.length === 1) {
    facts.push(mn
      ? 'Энэ хүний талаар нэмэлт мэдээлэл хараахан хадгалагдаагүй байна.'
      : 'No further information has been recorded about this person yet.');
  }

  return facts;
}
