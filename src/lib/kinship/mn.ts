import type { RelationshipDescriptor, GenderBucket } from '@/lib/relationships/types';
import type { KinshipLocale, KinshipTerm } from './types';

/**
 * Mongolian (Cyrillic) kinship terminology.
 *
 * Mongolian kinship is more precise than English in the places that matter to a
 * family archive, and ROOTS keeps that precision instead of flattening it:
 *
 *   · Paternal and maternal lines are different words — авга vs нагац.
 *   · Descent through a son and through a daughter are different words —
 *     ач vs зээ. A grandson through your son is an ач хүү; through your
 *     daughter he is a зээ хүү.
 *   · Siblings are named by relative age, not by gender alone — ах, эгч, дүү.
 *
 * Where usage genuinely varies (the deeper ancestor terms, and үеэл vs бүл),
 * the term is marked `regional` and carries alternates and a note rather than
 * being asserted as the single correct word.
 */

interface GenderedTerm {
  male: string;
  female: string;
  neutral: string;
  alternates?: string[];
  note?: string;
  confidence?: KinshipTerm['confidence'];
}

/** Ancestors, indexed by how many generations up. */
const ANCESTORS: Record<number, GenderedTerm> = {
  1: { male: 'Аав', female: 'Ээж', neutral: 'Эцэг эх', alternates: ['Эцэг', 'Эх'] },
  2: { male: 'Өвөө', female: 'Эмээ', neutral: 'Өвөө эмээ' },
  3: { male: 'Элэнц өвөө', female: 'Элэнц эмээ', neutral: 'Элэнц' },
  4: { male: 'Хуланц өвөө', female: 'Хуланц эмээ', neutral: 'Хуланц' },
  5: {
    male: 'Дүчинц өвөө', female: 'Дүчинц эмээ', neutral: 'Дүчинц',
    confidence: 'regional',
    note: 'Таван үеийн өвөг дээдсийн нэршил нутаг бүрт өөр өөр байдаг.',
  },
  6: {
    male: 'Жичинц өвөө', female: 'Жичинц эмээ', neutral: 'Жичинц',
    confidence: 'regional',
    note: 'Зургаан үеийн өвөг дээдсийн нэршил нутаг бүрт өөр өөр байдаг.',
  },
  7: {
    male: 'Гуйчинц өвөө', female: 'Гуйчинц эмээ', neutral: 'Гуйчинц',
    confidence: 'regional',
    note: 'Долоон үеийн өвөг дээдсийн нэршил нутаг бүрт өөр өөр байдаг.',
  },
};

/** Descendants, indexed by how many generations down. */
const DESCENDANTS_VIA_SON: Record<number, GenderedTerm> = {
  1: { male: 'Хүү', female: 'Охин', neutral: 'Үр хүүхэд' },
  2: { male: 'Ач хүү', female: 'Ач охин', neutral: 'Ач' },
  3: { male: 'Гуч хүү', female: 'Гуч охин', neutral: 'Гуч', confidence: 'regional' },
};

const DESCENDANTS_VIA_DAUGHTER: Record<number, GenderedTerm> = {
  1: { male: 'Хүү', female: 'Охин', neutral: 'Үр хүүхэд' },
  2: { male: 'Зээ хүү', female: 'Зээ охин', neutral: 'Зээ' },
  3: { male: 'Гуч хүү', female: 'Гуч охин', neutral: 'Гуч', confidence: 'regional' },
};

function pick(term: GenderedTerm, gender: GenderBucket): KinshipTerm {
  const label = gender === 'male' ? term.male : gender === 'female' ? term.female : term.neutral;
  const result: KinshipTerm = { label, confidence: term.confidence ?? 'standard' };
  if (term.alternates) result.alternates = term.alternates;
  if (term.note) result.note = term.note;
  return result;
}

function ancestorTerm(up: number, gender: GenderBucket, side: RelationshipDescriptor['side']): KinshipTerm {
  const entry = ANCESTORS[up];
  if (!entry) {
    return {
      label: `${up} дээд үеийн өвөг дээдэс`,
      confidence: 'generic',
      note: 'Энэ үеийн тусгай нэршил хадгалагдаагүй тул үеэр нь тэмдэглэв.',
    };
  }

  const term = pick(entry, gender);

  // Мaternal grandparents take the нагац qualifier. Beyond grandparents the
  // side is expressed as a qualifier phrase rather than a distinct word.
  if (up === 2 && side === 'maternal') {
    return {
      label: gender === 'female' ? 'Нагац эмээ' : 'Нагац өвөө',
      alternates: [term.label],
      confidence: 'standard',
      note: 'Ээжийн талын өвөө эмээ.',
    };
  }
  // Only the maternal line takes a qualifier. The paternal line is the
  // unmarked default — "авга талын элэнц өвөө" would mean something else
  // entirely (the side of a paternal uncle), not simply "father's father's father".
  if (up >= 3 && side === 'maternal') {
    return {
      ...term,
      label: `Нагац талын ${term.label.toLocaleLowerCase('mn-MN')}`,
      alternates: [term.label, ...(term.alternates ?? [])],
    };
  }

  return term;
}

function descendantTerm(down: number, gender: GenderBucket, viaGender: GenderBucket): KinshipTerm {
  const table = viaGender === 'female' ? DESCENDANTS_VIA_DAUGHTER : DESCENDANTS_VIA_SON;
  const entry = table[down];

  if (!entry) {
    return {
      label: `${down} дэх үеийн үр сад`,
      confidence: 'generic',
      note: 'Энэ үеийн тусгай нэршил хадгалагдаагүй тул үеэр нь тэмдэглэв.',
    };
  }

  const term = pick(entry, gender);
  if (down === 2) {
    if (viaGender === 'male') {
      return { ...term, note: 'Хүүгийн хүүхэд — ач.' };
    }
    if (viaGender === 'female') {
      return { ...term, note: 'Охины хүүхэд — зээ.' };
    }
    // Without knowing which child it came through we must not choose ач or зээ.
    return {
      label: gender === 'male' ? 'Ач/зээ хүү' : gender === 'female' ? 'Ач/зээ охин' : 'Ач зээ',
      confidence: 'generic',
      note: 'Хүү эсвэл охины аль талаар үргэлжилсэн нь тодорхойгүй тул ач, зээг ялгаагүй болно.',
    };
  }
  return term;
}

function siblingTerm(descriptor: RelationshipDescriptor): KinshipTerm {
  const { targetGender, relativeAge, half } = descriptor;
  const halfNote = half ? 'Нэг эцэг эсвэл нэг эх нэгтэй ах дүү.' : undefined;

  let base: KinshipTerm;
  if (relativeAge === 'older') {
    base = targetGender === 'female'
      ? { label: 'Эгч', confidence: 'standard' }
      : { label: 'Ах', confidence: 'standard' };
  } else if (relativeAge === 'younger') {
    base = targetGender === 'female'
      ? { label: 'Дүү охин', alternates: ['Дүү'], confidence: 'standard' }
      : targetGender === 'male'
        ? { label: 'Дүү хүү', alternates: ['Дүү'], confidence: 'standard' }
        : { label: 'Дүү', confidence: 'standard' };
  } else {
    // Mongolian has no age-neutral sibling word; saying "ах" without knowing
    // would be a guess, so we show both and explain why.
    base = targetGender === 'female'
      ? { label: 'Эгч/дүү', confidence: 'generic', note: 'Төрсөн он тодорхойгүй тул эгч, дүүг ялгаагүй.' }
      : targetGender === 'male'
        ? { label: 'Ах/дүү', confidence: 'generic', note: 'Төрсөн он тодорхойгүй тул ах, дүүг ялгаагүй.' }
        : { label: 'Ах дүү', confidence: 'generic' };
  }

  if (halfNote) {
    return { ...base, note: base.note ? `${base.note} ${halfNote}` : halfNote };
  }
  return base;
}

function piblingTerm(descriptor: RelationshipDescriptor): KinshipTerm {
  const { side, targetGender, removed = 0 } = descriptor;

  if (removed === 0) {
    if (side === 'paternal') {
      return targetGender === 'female'
        ? { label: 'Авга эгч', alternates: ['Авга'], confidence: 'standard', note: 'Аавын эгч, дүү.' }
        : { label: 'Авга ах', alternates: ['Авга'], confidence: 'standard', note: 'Аавын ах, дүү.' };
    }
    if (side === 'maternal') {
      return targetGender === 'female'
        ? { label: 'Нагац эгч', alternates: ['Нагац'], confidence: 'standard', note: 'Ээжийн эгч, дүү.' }
        : { label: 'Нагац ах', alternates: ['Нагац'], confidence: 'standard', note: 'Ээжийн ах, дүү.' };
    }
    return {
      label: targetGender === 'female' ? 'Авга/нагац эгч' : 'Авга/нагац ах',
      confidence: 'generic',
      note: 'Аав, ээжийн аль талын хамаатан нь тодорхойгүй байна.',
    };
  }

  if (removed === 1) {
    return {
      label: targetGender === 'female' ? 'Өвөөгийн эгч дүү' : 'Өвөөгийн ах дүү',
      confidence: 'generic',
      note: 'Өвөө, эмээгийн ах дүү.',
    };
  }

  return {
    label: `${removed + 2} дээд үеийн ах дүү`,
    confidence: 'generic',
  };
}

function niblingTerm(descriptor: RelationshipDescriptor): KinshipTerm {
  const { targetGender, viaGender, removed = 0 } = descriptor;

  if (removed > 0) {
    return { label: 'Ач зээгийн үр хүүхэд', confidence: 'generic' };
  }

  // A brother's child is ач; a sister's child is зээ. Same distinction as
  // grandchildren, applied one branch across.
  if (viaGender === 'male') {
    return {
      label: targetGender === 'female' ? 'Ач охин' : 'Ач хүү',
      confidence: 'standard',
      note: 'Ах, дүүгийн хүүхэд.',
    };
  }
  if (viaGender === 'female') {
    return {
      label: targetGender === 'female' ? 'Зээ охин' : 'Зээ хүү',
      confidence: 'standard',
      note: 'Эгч, дүүгийн хүүхэд.',
    };
  }
  return { label: 'Ач зээ', confidence: 'generic' };
}

function cousinTerm(descriptor: RelationshipDescriptor): KinshipTerm {
  const { degree = 1, removed = 0, side, viaGender } = descriptor;

  let base: KinshipTerm;
  if (degree === 1) {
    // үеэл / бүл usage varies by region and by which sibling the line runs
    // through. We give the most common reading and always show the alternate.
    if (side === 'paternal' && viaGender === 'male') {
      base = {
        label: 'Үеэл',
        alternates: ['Авга үеэл'],
        confidence: 'standard',
        note: 'Авга ахын хүүхэд.',
      };
    } else if (side === 'maternal' || viaGender === 'female') {
      base = {
        label: 'Бүл',
        alternates: ['Нагац үеэл', 'Үеэл'],
        confidence: 'regional',
        note: 'Нагац болон эгч дүүгийн талын үеэлийг зарим нутагт бүл гэдэг.',
      };
    } else {
      base = { label: 'Үеэл', alternates: ['Бүл'], confidence: 'generic' };
    }
  } else {
    base = {
      label: `${degree + 1} дэх үеийн үеэл`,
      confidence: 'generic',
      note: 'Хол төрлийн үеэл.',
    };
  }

  if (removed > 0) {
    return {
      ...base,
      label: `${base.label} (${removed} үе зөрүүтэй)`,
      confidence: base.confidence === 'standard' ? 'regional' : base.confidence,
    };
  }
  return base;
}

function partnerTerm(gender: GenderBucket): KinshipTerm {
  if (gender === 'male') return { label: 'Нөхөр', alternates: ['Хань'], confidence: 'standard' };
  if (gender === 'female') return { label: 'Эхнэр', alternates: ['Хань'], confidence: 'standard' };
  return { label: 'Хань', confidence: 'standard' };
}

function inLawTerm(descriptor: RelationshipDescriptor): KinshipTerm {
  const { up, down, kind: _kind, targetGender } = descriptor;

  // Partner's parents.
  if (up === 1 && down === 0) {
    return targetGender === 'female'
      ? { label: 'Хадам ээж', confidence: 'standard' }
      : { label: 'Хадам аав', confidence: 'standard' };
  }
  // Child's partner.
  if (up === 0 && down === 1) {
    return targetGender === 'female'
      ? { label: 'Бэр', confidence: 'standard', note: 'Хүүгийн эхнэр.' }
      : { label: 'Хүргэн', confidence: 'standard', note: 'Охины нөхөр.' };
  }
  // Sibling's partner, or partner's sibling.
  if (up === 1 && down === 1) {
    return targetGender === 'female'
      ? { label: 'Бэр', alternates: ['Хадам эгч'], confidence: 'regional' }
      : { label: 'Хүргэн ах', alternates: ['Хадам ах'], confidence: 'regional' };
  }
  if (up === 2 && down === 0) {
    return targetGender === 'female'
      ? { label: 'Хадам эмээ', confidence: 'regional' }
      : { label: 'Хадам өвөө', confidence: 'regional' };
  }

  return { label: 'Хадам төрөл', confidence: 'generic', note: 'Ханийн талын хамаатан.' };
}

export const mnKinship: KinshipLocale = {
  code: 'mn',
  name: 'Монгол',
  self: 'Би',
  unknown: {
    label: 'Тодорхойгүй',
    confidence: 'generic',
    note: 'Хадгалагдсан мэдээллээс хамаарлыг тогтоох боломжгүй байна.',
  },

  describe(descriptor: RelationshipDescriptor): KinshipTerm {
    switch (descriptor.kind) {
      case 'self':
        return { label: 'Би', confidence: 'standard' };
      case 'partner':
        return partnerTerm(descriptor.targetGender);
      case 'ancestor': {
        const term = ancestorTerm(descriptor.up, descriptor.targetGender, descriptor.side);
        // Adoption is part of the family's truth, not a footnote to hide.
        if (descriptor.edgeType && descriptor.edgeType !== 'biological' && descriptor.edgeType !== 'unknown') {
          const labels: Record<string, string> = {
            adoptive: 'Үрчилж авсан', step: 'Хойд', foster: 'Асран хамгаалагч', guardian: 'Асран хамгаалагч',
          };
          const prefix = labels[descriptor.edgeType];
          if (prefix) return { ...term, label: `${prefix} ${term.label.toLocaleLowerCase('mn-MN')}` };
        }
        return term;
      }
      case 'descendant':
        return descendantTerm(descriptor.down, descriptor.targetGender, descriptor.viaGender ?? 'unknown');
      case 'sibling':
        return siblingTerm(descriptor);
      case 'pibling':
        return piblingTerm(descriptor);
      case 'nibling':
        return niblingTerm(descriptor);
      case 'cousin':
        return cousinTerm(descriptor);
      case 'in_law':
        return inLawTerm(descriptor);
      case 'step':
        return { label: 'Хойд төрөл', confidence: 'generic' };
      case 'unrelated':
      default:
        return mnKinship.unknown;
    }
  },
};
